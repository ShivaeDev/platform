import { testProjects } from "#vitest.ts";

// @ts-expect-error The shared projects cannot take suite exclusions.
testProjects({ exclude: ["e2e/**"] });
