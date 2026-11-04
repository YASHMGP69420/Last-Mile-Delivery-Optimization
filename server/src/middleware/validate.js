/**
 * Declarative request validation helper
 * @param {Function} validatorFn - Function receiving req, returns array of error messages or objects
 */
const validate = (validatorFn) => {
  return (req, res, next) => {
    const errors = validatorFn(req);
    if (errors && errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request payload failed schema validation',
          details: errors,
        },
      });
    }
    next();
  };
};

module.exports = {
  validate,
};
