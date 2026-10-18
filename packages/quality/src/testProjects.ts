import { fileURLToPath } from "node:url";
import { Config, ConfigProvider, Effect } from "effect";
import { coverageConfigDefaults, defaultExclude, type TestUserConfig } from "vitest/config";
import type { Environment } from "#naming/testName.ts";

const EXTENSION = "?(c|m)[jt]s?(x)";

const TYPECHECK_ALONE = `**/typecheck.test.${EXTENSION}`;

function named(environment?: Environment): string {
	return environment === undefined ? `**/*.@(test|spec).${EXTENSION}` : `**/*.${environment}.@(test|spec).${EXTENSION}`;
}

function excluding(...patterns: readonly string[]): string[] {
	return [...defaultExclude, named("typecheck"), TYPECHECK_ALONE, ...patterns];
}

export interface TestProjectsOptions {
	readonly coverage?: boolean | NonNullable<TestUserConfig["coverage"]>;
}

export function testProjects({ coverage = false }: TestProjectsOptions = {}): TestUserConfig {
	const ci = Effect.runSync(Config.String("CI").pipe(Config.withDefault("")).parse(ConfigProvider.fromEnv()));
	return {
		...(coverage === false
			? {}
			: {
					coverage: {
						enabled: true,
						exclude: [...coverageConfigDefaults.exclude, "**/*.d.ts", "**/*.test.*", "**/*.spec.*", "**/test-support/**"],
						include: ["src/**/*.{ts,tsx}"],
						provider: "v8",
						...(coverage === true ? {} : coverage),
					},
				}),
		project: ["unit", "dom"],
		projects: [
			{ extends: true, test: { environment: "node", exclude: excluding(named("dom"), named("slow")), include: [named()], name: "unit" } },
			{
				extends: true,
				test: {
					environment: fileURLToPath(import.meta.resolve("#domEnvironment.config.ts")),
					exclude: excluding(named("slow")),
					include: [named("dom")],
					name: "dom",
				},
			},
			{ extends: true, test: { environment: "node", exclude: excluding(), include: [named("slow")], name: "slow" } },
		],
		silent: ci ? false : "passed-only",
		// Tests that start real servers, browsers or CLIs need seconds on a busy CI runner, and Vitest's 5s default fails them for load, not behavior.
		testTimeout: 30_000,
	};
}
