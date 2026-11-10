const demoDataService = require('../services/demoDataService');

const getStatus = async (req, res, next) => {
  try {
    const status = await demoDataService.getDemoDataStatus();
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (err) {
    next(err);
  }
};

const importDemoData = async (req, res, next) => {
  try {
    const status = await demoDataService.importDemoDataset(req.user?.id || null);
    res.status(201).json({
      success: true,
      message: 'Prebuilt Bhubaneswar demo dataset imported cleanly.',
      data: status,
    });
  } catch (err) {
    next(err);
  }
};

const deleteDemoData = async (req, res, next) => {
  try {
    const result = await demoDataService.deleteDemoDataset();
    res.status(200).json({
      success: true,
      message: `Removed ${result.deletedCount} demo record(s). Production data untouched.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getStatus,
  importDemoData,
  deleteDemoData,
};
