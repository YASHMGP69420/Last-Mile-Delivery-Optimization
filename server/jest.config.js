module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  setupFilesAfterEnv: [
    './tests/setup.js'
  ],
  testTimeout: 20000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true
};
