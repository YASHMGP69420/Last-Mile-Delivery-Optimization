const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const env = require('./config/env');
const { parseAllowedOrigins, createCorsOptionsDelegate } = require('./config/cors');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

function createApp(overrides = {}) {
  const nodeEnv = overrides.nodeEnv ?? env.NODE_ENV;
  const serveClient = overrides.serveClient ?? env.SERVE_CLIENT;
  const trustProxy =
    overrides.trustProxy !== undefined
      ? overrides.trustProxy
      : overrides.nodeEnv !== undefined
        ? env.parseTrustProxy(process.env.TRUST_PROXY, nodeEnv)
        : env.TRUST_PROXY;
  const forceHttpsCsp = overrides.forceHttpsCsp ?? env.FORCE_HTTPS_CSP;
  const allowedOrigins =
    overrides.allowedOrigins ??
    parseAllowedOrigins(overrides.clientOrigin ?? env.CLIENT_ORIGIN, nodeEnv);
  const clientDistDir = path.resolve(
    overrides.clientDistDir ?? path.resolve(__dirname, '../../client/dist')
  );

  const app = express();

  app.set('isDraining', false);
  app.set('trust proxy', trustProxy);

  // Security HTTP headers (CSP + COOP)
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
          formAction: ["'self'"],
          scriptSrc: ["'self'", 'https://accounts.google.com'],
          scriptSrcAttr: ["'none'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
            'https://accounts.google.com',
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https://maps.geoapify.com',
            'https://tile.openstreetmap.org',
            'https://*.tile.openstreetmap.org',
            'https://*.basemaps.cartocdn.com',
            'https://lh3.googleusercontent.com',
          ],
          connectSrc: [
            "'self'",
            'ws:',
            'wss:',
            'https://accounts.google.com',
            'https://maps.geoapify.com',
            'https://api.geoapify.com',
            'https://tile.openstreetmap.org',
            'https://*.tile.openstreetmap.org',
            'https://*.basemaps.cartocdn.com',
          ],
          frameSrc: ["'self'", 'https://accounts.google.com'],
          upgradeInsecureRequests: forceHttpsCsp ? [] : null,
        },
      },
    })
  );

  // Orchestrator / Load Balancer probes before CORS error blocking and rate limiters
  app.get('/healthz', (req, res) => {
    const isDraining = Boolean(app.get('isDraining'));
    if (isDraining) {
      return res.status(503).json({
        success: false,
        status: 'DRAINING',
        timestamp: new Date().toISOString(),
      });
    }
    return res.status(200).json({
      success: true,
      status: 'OK',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/readyz', (req, res) => {
    const isDraining = Boolean(app.get('isDraining'));
    const isDbConnected = mongoose.connection.readyState === 1;
    const isReady = !isDraining && isDbConnected;
    return res.status(isReady ? 200 : 503).json({
      success: isReady,
      status: isDraining ? 'DRAINING' : isDbConnected ? 'READY' : 'DEGRADED',
      database: isDbConnected ? 'CONNECTED' : 'DISCONNECTED',
      timestamp: new Date().toISOString(),
    });
  });

  // Cross-Origin Resource Sharing (shared policy with Socket.IO)
  app.use(
    cors(
      createCorsOptionsDelegate({
        allowedOrigins,
        nodeEnv,
        serveClient,
      })
    )
  );

  // Body Parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Logging (non-test environments)
  if (nodeEnv !== 'test') {
    app.use(morgan('dev'));
  }

  // Mount API v1
  app.use('/api/v1', routes);

  // Optional Single-Origin static & SPA client hosting
  if (serveClient) {
    const clientIndexPath = path.join(clientDistDir, 'index.html');
    if (!fs.existsSync(clientIndexPath)) {
      throw new Error(
        `SERVE_CLIENT=true requires built client assets, but "${clientIndexPath}" was not found. Run "npm --prefix client run build" first.`
      );
    }

    // Isolate unknown /api/* paths so they always return JSON 404 instead of SPA HTML
    app.use('/api', notFoundHandler);

    app.use(
      '/assets',
      express.static(path.join(clientDistDir, 'assets'), {
        maxAge: '1y',
        immutable: true,
        setHeaders: (res) => {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        },
      })
    );

    app.use(
      express.static(clientDistDir, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );

    app.get('*', (req, res, next) => {
      if (
        req.path === '/api' ||
        req.path.startsWith('/api/') ||
        req.path === '/socket.io' ||
        req.path.startsWith('/socket.io/') ||
        Boolean(path.posix.extname(req.path))
      ) {
        return next();
      }
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(clientIndexPath);
    });
  }

  // 404 & Centralized Error Handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();
app.createApp = createApp;

module.exports = app;
