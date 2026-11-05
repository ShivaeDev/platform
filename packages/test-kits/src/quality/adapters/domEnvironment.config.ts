import { createRequire } from "node:module";
import { join } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import type { Environment } from "vitest/runtime";

// Vitest loads environments outside the project graph; Node resolves the consumer’s source conditions.
const consumer = createRequire(join(process.cwd(), "package.json"));
const { default: environment }: { readonly default: Environment } = await import(
	pathToFileURL(consumer.resolve("@shivaedev/test-story/server/adapters/domEnvironment.config.ts")).href
);

export default environment;
