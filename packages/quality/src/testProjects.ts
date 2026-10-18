import { Config, ConfigProvider, Effect } from "effect";
import { defaultExclude, type TestUserConfig } from "vitest/config";
import type { Environment } from "#naming/testName.ts";

const EXTENSION = "?(c|m)[jt]s?(x)";

const TYPECHECK_ALONE = `**/typecheck.test.${EXTENSION}`;

function named(environment?: Environment): string {
	return environment === undefined ? `**/*.@(test|spec).${EXTENSION}` : `**/*.${environment}.@(test|spec).${EXTENSION}`;
}

function excluding(...patterns: readonly string[]): string[] {
	return [...defaultExclude, named("typecheck"), TYPECHECK_ALONE, ...patterns];
}

export function testProjects(): TestUserConfig {
	const ci = Effect.runSync(Config.String("CI").pipe(Config.withDefault("")).parse(ConfigProvider.fromEnv()));
	return {
		project: ["unit", "dom"],
		projects: [
			{ extends: true, test: { environment: "node", exclude: excluding(named("dom"), named("slow")), include: [named()], name: "unit" } },
			{ extends: true, test: { environment: "happy-dom", exclude: excluding(named("slow")), include: [named("dom")], name: "dom" } },
			{ extends: true, test: { environment: "node", exclude: excluding(), include: [named("slow")], name: "slow" } },
		],
		silent: ci ? false : "passed-only",
		// Tests that start real servers, browsers or CLIs need seconds on a busy CI runner, and Vitest's 5s default fails them for load, not behavior.
		testTimeout: 30_000,
	};
}
