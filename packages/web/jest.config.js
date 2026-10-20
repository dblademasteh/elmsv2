const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

/**
 * The unit tests cover the pure logic — URL handling, date formatting and
 * the API client's request plumbing — so they run in the node environment.
 * Component tests would need jsdom and testing-library, neither of which is
 * installed.
 */
module.exports = createJestConfig({
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  collectCoverageFrom: ['src/lib/**/*.ts', '!src/lib/**/*.test.ts'],
})
