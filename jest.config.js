module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['<rootDir>/packages/**/*.test.ts'],
  collectCoverageFrom: [
    'packages/*/lib/**/*.ts',
    '!packages/*/lib/**/*.d.ts',
    '!packages/*/lib/**/*.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  },
  // Force exit after tests complete to prevent hanging workers
  forceExit: true,
  // Detect open handles that prevent Jest from exiting
  detectOpenHandles: true
};