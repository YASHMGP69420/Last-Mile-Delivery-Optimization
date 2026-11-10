const { connectDB, disconnectDB } = require('../config/db');
const demoDataService = require('../services/demoDataService');

/**
 * Legacy seed entrypoint refactored to avoid seeding hardcoded weak demo passwords.
 * Use `--delete` to purge tagged demo data, or run without flags to import the
 * non-destructive prebuilt demo dataset (`isDemoData: true`).
 */
const runCli = async () => {
  const isDelete = process.argv.includes('--delete');
  try {
    await connectDB();
    if (isDelete) {
      const result = await demoDataService.deleteDemoDataset();
      console.log(`[DemoData CLI] Deleted ${result.deletedCount} demo records.`);
    } else {
      const status = await demoDataService.importDemoDataset(null);
      console.log('[DemoData CLI] Imported prebuilt demo dataset:', status.counts);
    }
    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('[DemoData CLI] Error:', err.message);
    try {
      await disconnectDB();
    } catch {
      // Ignore disconnect cleanup error
    }
    process.exit(1);
  }
};

if (require.main === module) {
  runCli();
}

module.exports = { runCli };
