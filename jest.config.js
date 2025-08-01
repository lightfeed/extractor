/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/__tests__/**/*.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
  collectCoverage: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/dev/**/*.ts",
    "!src/**/*.d.ts",
    "!src/types.ts",
    "!src/example.ts",
    "!**/node_modules/**",
    "!**/vendor/**",
  ],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  setupFiles: ["<rootDir>/tests/setup.ts"],
  watchman: false,
  detectOpenHandles: true,
};
