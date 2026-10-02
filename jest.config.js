module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/tests/**/*.test.js', '!**/tests/performance/**'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/utils/seedData.js',
    '!src/config/**',
    '!src/models/**' // Models are tested through integration tests
  ],
  // Ratchet: set to the measured level when CI first ran the suite
  // (2026-10-02: 36% statements, 26% branches, 32% functions, 37% lines).
  // Raise these as the DGD escrow path and the v3 marketplace services get
  // tests; never lower them.
  coverageThreshold: {
    global: {
      branches: 25,
      functions: 30,
      lines: 35,
      statements: 35
    }
  },
  coverageReporters: ['text', 'text-summary', 'lcov', 'html']
};
