import { createRequire } from "node:module";
import { join } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import type { Environment } from "vitest/runtime";

// Resolve the DOM plugin from the consumer; depending on test-story would cycle through its Quality tooling.
const consumer = createRequire(join(process.cwd(), "package.json"));
const { default: environment }: { readonly default: Environment } = await import(
	pathToFileURL(consumer.resolve("@shivaedev/test-story/server/domEnvironment.config.ts")).href
);

export default environment;
