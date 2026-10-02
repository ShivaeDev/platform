// Vitest reads a test file's environment from these pragmas anywhere in its text, so tests never spell them out whole.
export const VITEST_ENVIRONMENT = ["@vitest", "environment"].join("-");

export const JEST_ENVIRONMENT = ["@jest", "environment"].join("-");
