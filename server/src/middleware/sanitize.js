/**
 * Global Ingress Sanitization Middleware
 * Neutralizes NoSQL query operator injection and prototype pollution across all request trees.
 */

function sanitizeObject(target) {
  if (!target || typeof target !== 'object') {
    return target;
  }

  // Safely skip non-extensible, frozen, or non-plain instances
  if (
    !Object.isExtensible(target) ||
    target instanceof Date ||
    target instanceof RegExp ||
    (typeof Buffer !== 'undefined' && Buffer.isBuffer(target))
  ) {
    return target;
  }

  if (Array.isArray(target)) {
    for (let i = 0; i < target.length; i++) {
      target[i] = sanitizeObject(target[i]);
    }
    return target;
  }

  // If a plain object's prototype was manipulated, reset to Object.prototype
  const proto = Object.getPrototypeOf(target);
  if (
    Object.prototype.toString.call(target) === '[object Object]' &&
    proto !== null &&
    proto !== Object.prototype
  ) {
    try {
      Object.setPrototypeOf(target, Object.prototype);
    } catch {
      // Safe skip if prototype cannot be set
    }
  }

  const keys = Object.getOwnPropertyNames(target);
  for (const key of keys) {
    if (
      key.startsWith('$') ||
      key.includes('.') ||
      key === '__proto__' ||
      key === 'constructor' ||
      key === 'prototype'
    ) {
      try {
        delete target[key];
      } catch {
        // Safe skip if property is non-configurable
      }
    } else {
      try {
        target[key] = sanitizeObject(target[key]);
      } catch {
        // Safe skip if getter/setter throws
      }
    }
  }

  return target;
}

const noSqlSanitizer = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    sanitizeObject(req.params);
  }
  next();
};

module.exports = {
  noSqlSanitizer,
  sanitizeObject,
};
