#!/usr/bin/env node

/**
 * SmartRoute 4-Tier E2E CLI Test Runner
 *
 * Usage:
 *   node tests/e2e/runner.js [options]
 *
 * Options:
 *   --tier=<1|2|3|4|all>   Filter test execution by tier (default: all)
 *   --verbose, -v          Show detailed test assertions and progress
 *   --bail, -b             Stop immediately on first test failure
 *   --help, -h             Show help message
 */

// Ensure test environment
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const harness = require('./harness/testServer');
const { cleanDatabase } = harness;
const fixtures = require('./harness/fixtures');

// ANSI Color Codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const GRAY = '\x1b[90m';

// Parse CLI Flags
const args = process.argv.slice(2);
let selectedTier = 'all';
let verbose = false;
let bail = false;

for (const arg of args) {
  if (arg === '--help' || arg === '-h') {
    printHelp();
    process.exit(0);
  } else if (arg.startsWith('--tier=')) {
    selectedTier = arg.split('=')[1].toLowerCase();
  } else if (arg === '-t' && args[args.indexOf(arg) + 1]) {
    selectedTier = args[args.indexOf(arg) + 1].toLowerCase();
  } else if (arg === '--verbose' || arg === '-v') {
    verbose = true;
  } else if (arg === '--bail' || arg === '-b') {
    bail = true;
  }
}

function printHelp() {
  console.log(`
${BOLD}SmartRoute E2E Test Runner${RESET}
Run opaque-box requirement-driven E2E tests across 4 testing tiers.

${BOLD}Usage:${RESET}
  node tests/e2e/runner.js [options]

${BOLD}Options:${RESET}
  --tier=<1|2|3|4|all>   Run specific testing tier (default: all)
  --verbose, -v          Verbose output showing each assertion
  --bail, -b             Abort execution on the first failure
  --help, -h             Show this help screen
`);
}

// Discover Test Suites
const SUITE_DIRECTORIES = [
  { tier: 1, dir: path.join(__dirname, 'tier1-features'), name: 'Tier 1: Core Feature Isolation' },
  { tier: 2, dir: path.join(__dirname, 'tier2-boundaries'), name: 'Tier 2: Boundary & Corner Cases' },
  { tier: 3, dir: path.join(__dirname, 'tier3-pairwise'), name: 'Tier 3: Cross-Feature Pairwise Integrations' },
  { tier: 4, dir: path.join(__dirname, 'tier4-workloads'), name: 'Tier 4: Real-World Workloads & Stress Scenarios' },
];

async function collectSuites() {
  const suitesToRun = [];

  for (const tierConfig of SUITE_DIRECTORIES) {
    if (selectedTier !== 'all' && String(tierConfig.tier) !== selectedTier) {
      continue;
    }

    if (!fs.existsSync(tierConfig.dir)) {
      continue;
    }

    const files = fs.readdirSync(tierConfig.dir).filter((f) => f.endsWith('.test.js')).sort();
    for (const file of files) {
      const fullPath = path.join(tierConfig.dir, file);
      try {
        const suiteModule = require(fullPath);
        suitesToRun.push({
          tier: tierConfig.tier,
          tierName: tierConfig.name,
          file,
          fullPath,
          suite: suiteModule,
        });
      } catch (err) {
        console.error(`${RED}[Runner Error] Failed to load test suite ${file}:${RESET}`, err);
        process.exit(1);
      }
    }
  }

  return suitesToRun;
}

// Runner Core
async function run() {
  const startTime = Date.now();

  console.log(`\n${CYAN}${BOLD}================================================================================${RESET}`);
  console.log(`  ${BOLD}SMARTROUTE 4-TIER E2E TEST RUNNER${RESET}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'test'} | Node: ${process.version} | Filter: tier=${selectedTier}`);
  console.log(`  Target Base URL: /api/v1 (in-process test harness)`);
  console.log(`${CYAN}${BOLD}================================================================================${RESET}\n`);

  const { connection } = await harness.startTestEnvironment();
  await cleanDatabase(connection);

  const suites = await collectSuites();
  if (suites.length === 0) {
    console.log(`${YELLOW}No test suites matched the selected tier filter: ${selectedTier}${RESET}\n`);
    await harness.stopTestEnvironment();
    process.exit(0);
  }

  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  const tierMetrics = {
    1: { total: 0, passed: 0, failed: 0, skipped: 0 },
    2: { total: 0, passed: 0, failed: 0, skipped: 0 },
    3: { total: 0, passed: 0, failed: 0, skipped: 0 },
    4: { total: 0, passed: 0, failed: 0, skipped: 0 },
  };

  const failureDetails = [];
  let currentTier = null;

  for (const suiteMeta of suites) {
    if (currentTier !== suiteMeta.tier) {
      currentTier = suiteMeta.tier;
      console.log(`\n${BOLD}${CYAN}[TIER ${currentTier}] ${suiteMeta.tierName}${RESET}`);
    }

    const suiteStartTime = Date.now();
    let suitePassCount = 0;
    let suiteFailCount = 0;
    let suiteSkipCount = 0;

    // Test collector structures
    const testQueue = [];
    const beforeEachHooks = [];
    const afterEachHooks = [];

    const describe = (desc, fn) => {
      // Direct execution inside describe
      fn();
    };

    const it = (testName, testFn) => {
      testQueue.push({ name: testName, fn: testFn, skip: false });
    };

    it.skip = (testName, testFn) => {
      testQueue.push({ name: testName, fn: testFn, skip: true });
    };

    const beforeEach = (fn) => {
      beforeEachHooks.push(fn);
    };

    const afterEach = (fn) => {
      afterEachHooks.push(fn);
    };

    try {
      if (typeof suiteMeta.suite.run === 'function') {
        await suiteMeta.suite.run({
          describe,
          it,
          beforeEach,
          afterEach,
          harness,
          fixtures,
          assert,
          verbose,
        });
      } else if (typeof suiteMeta.suite === 'function') {
        await suiteMeta.suite({
          describe,
          it,
          beforeEach,
          afterEach,
          harness,
          fixtures,
          assert,
          verbose,
        });
      }
    } catch (err) {
      console.error(`  ${RED}✖ Suite registration failed in ${suiteMeta.file}:${RESET} ${err.message}`);
      failureDetails.push({
        suite: suiteMeta.file,
        test: 'Suite Initialization',
        error: err,
      });
      totalFailed++;
      tierMetrics[suiteMeta.tier].failed++;
      if (bail) break;
      continue;
    }

    // Execute tests in queue
    for (const testCase of testQueue) {
      totalTests++;
      tierMetrics[suiteMeta.tier].total++;

      if (testCase.skip) {
        totalSkipped++;
        suiteSkipCount++;
        tierMetrics[suiteMeta.tier].skipped++;
        if (verbose) {
          console.log(`    ${YELLOW}- [SKIP] ${testCase.name}${RESET}`);
        }
        continue;
      }

      // Run beforeEach hooks
      for (const hook of beforeEachHooks) {
        await hook();
      }

      const testStart = Date.now();
      try {
        await testCase.fn();
        const testDuration = Date.now() - testStart;
        totalPassed++;
        suitePassCount++;
        tierMetrics[suiteMeta.tier].passed++;

        if (verbose) {
          console.log(`    ${GREEN}✓ ${testCase.name} ${GRAY}(${testDuration} ms)${RESET}`);
        }
      } catch (err) {
        const testDuration = Date.now() - testStart;
        totalFailed++;
        suiteFailCount++;
        tierMetrics[suiteMeta.tier].failed++;

        console.log(`    ${RED}✖ [FAIL] ${testCase.name} ${GRAY}(${testDuration} ms)${RESET}`);
        failureDetails.push({
          tier: suiteMeta.tier,
          suite: suiteMeta.file,
          test: testCase.name,
          error: err,
        });

        if (bail) {
          console.log(`\n${RED}${BOLD}Bail flag set — aborting test execution immediately.${RESET}`);
          break;
        }
      } finally {
        // Run afterEach hooks
        for (const hook of afterEachHooks) {
          try {
            await hook();
          } catch (hookErr) {
            console.error(`    ${RED}afterEach error: ${hookErr.message}${RESET}`);
          }
        }
      }

      if (bail && suiteFailCount > 0) break;
    }

    const suiteDuration = Date.now() - suiteStartTime;
    const suiteStatusIcon = suiteFailCount === 0 ? `${GREEN}✓${RESET}` : `${RED}✖${RESET}`;
    const suiteNameDisplay = suiteMeta.suite.name || suiteMeta.file;

    if (!verbose) {
      console.log(`  ${suiteStatusIcon} ${suiteMeta.file} ${GRAY}(${suiteDuration} ms)${RESET} - ${GREEN}${suitePassCount} passed${RESET}${suiteFailCount > 0 ? `, ${RED}${suiteFailCount} failed${RESET}` : ''}${suiteSkipCount > 0 ? `, ${YELLOW}${suiteSkipCount} skipped${RESET}` : ''}`);
    }

    // Inter-suite isolation barrier
    await cleanDatabase(connection);

    if (bail && suiteFailCount > 0) break;
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Print Failure Breakdown if any
  if (failureDetails.length > 0) {
    console.log(`\n${RED}${BOLD}--------------------------------------------------------------------------------${RESET}`);
    console.log(`${RED}${BOLD}FAILURES & DEFECTS DETECTED (${failureDetails.length}):${RESET}\n`);

    failureDetails.forEach((f, idx) => {
      console.log(`${RED}${BOLD}${idx + 1}) [Tier ${f.tier || '?'}] ${f.suite} > ${f.test}${RESET}`);
      console.log(`   ${GRAY}Message:${RESET} ${RED}${f.error.message}${RESET}`);
      if (f.error.stack) {
        const stackLines = f.error.stack.split('\n').slice(1, 5).join('\n');
        console.log(`   ${GRAY}${stackLines}${RESET}`);
      }
      console.log('');
    });
  }

  // Summary Metrics Banner
  console.log(`\n${CYAN}${BOLD}--------------------------------------------------------------------------------${RESET}`);
  console.log(`${BOLD}SUMMARY METRICS:${RESET}`);
  console.log(`  Total Suites:  ${suites.length}`);
  console.log(`  Total Tests:   ${totalTests}`);
  console.log(`  Passed:        ${GREEN}${BOLD}${totalPassed}${RESET}`);
  console.log(`  Failed:        ${totalFailed > 0 ? RED + BOLD : GRAY}${totalFailed}${RESET}`);
  console.log(`  Skipped:       ${totalSkipped > 0 ? YELLOW + BOLD : GRAY}${totalSkipped}${RESET}`);
  console.log(`  Duration:      ${totalDuration}s`);
  console.log(`\n${BOLD}TIER COVERAGE BREAKDOWN:${RESET}`);
  for (let t = 1; t <= 4; t++) {
    const m = tierMetrics[t];
    const tierStatus = m.failed === 0 ? `${GREEN}PASSED${RESET}` : `${RED}FAILED${RESET}`;
    console.log(`  Tier ${t} (${SUITE_DIRECTORIES[t - 1].name.split(':')[1].trim()}): ${m.passed}/${m.total} passed [${tierStatus}]`);
  }
  console.log(`${CYAN}${BOLD}================================================================================${RESET}`);

  await harness.cleanDatabase();
  await harness.stopTestEnvironment();

  if (totalFailed > 0) {
    console.log(`${RED}${BOLD}RESULT: FAILED (Exit Code: 1)${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`${GREEN}${BOLD}RESULT: ALL TESTS PASSED (Exit Code: 0)${RESET}\n`);
    process.exit(0);
  }
}

// Graceful signal termination handlers
let isShuttingDown = false;
async function handleTermination(signal) {
  if (isShuttingDown) {
    process.exit(signal === 'SIGINT' ? 130 : 143);
  }
  isShuttingDown = true;
  console.log(`\n\n${YELLOW}${BOLD}[Runner] Received ${signal} — executing clean database teardown...${RESET}`);
  try {
    await harness.cleanDatabase();
    await harness.stopTestEnvironment();
    console.log(`${GREEN}[Runner] Database and connections cleanly torn down.${RESET}`);
  } catch (err) {
    console.error(`${RED}[Runner] Teardown error on ${signal}:${RESET}`, err.message);
  }
  process.exit(signal === 'SIGINT' ? 130 : 143);
}

process.on('SIGINT', () => handleTermination('SIGINT'));
process.on('SIGTERM', () => handleTermination('SIGTERM'));

// Execute Runner
run().catch(async (err) => {
  console.error(`${RED}${BOLD}Fatal unhandled runner exception:${RESET}`, err);
  try {
    await harness.cleanDatabase();
    await harness.stopTestEnvironment();
  } catch (_) {}
  process.exit(1);
});
