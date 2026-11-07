const telemetryService = require('../services/telemetryService');
const { AppError } = require('../middleware/errorHandler');

/**
 * POST /api/v1/telemetry
 * Ingest live GPS / sensor telemetry ping
 */
const ingestTelemetry = async (req, res, next) => {
  try {
    const result = await telemetryService.recordTelemetry(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Telemetry ping ingested successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/telemetry/live
 * Return consolidated real-time fleet snapshot
 */
const getLiveFleet = async (req, res, next) => {
  try {
    const fleet = await telemetryService.getLiveFleetStatus();
    res.status(200).json({
      success: true,
      data: {
        fleet,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/telemetry/history/:vehicleId
 * Return historical GPS breadcrumb route
 */
const getVehicleHistory = async (req, res, next) => {
  try {
    const { vehicleId } = req.params;
    const limit = parseInt(req.query.limit, 10) || 50;
    const history = await telemetryService.getVehicleHistory(vehicleId, limit);
    res.status(200).json({
      success: true,
      data: {
        history,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/telemetry/alerts
 * List alerts (optionally unacknowledged)
 */
const getAlerts = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.acknowledged !== undefined) {
      filter.acknowledged = req.query.acknowledged === 'true';
    }
    if (req.query.alertType) {
      filter.alertType = req.query.alertType;
    }
    const alerts = await telemetryService.getAlerts(filter);
    res.status(200).json({
      success: true,
      data: {
        alerts,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/telemetry/alerts/:id/ack
 * Acknowledge an alert
 */
const acknowledgeAlert = async (req, res, next) => {
  try {
    const alert = await telemetryService.acknowledgeAlert(req.params.id, req.user.id);
    res.status(200).json({
      success: true,
      message: 'Alert acknowledged successfully',
      data: {
        alert,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  ingestTelemetry,
  getLiveFleet,
  getVehicleHistory,
  getAlerts,
  acknowledgeAlert,
};
