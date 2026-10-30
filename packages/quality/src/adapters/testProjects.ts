import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { coverageConfigDefaults, defaultExclude, type TestUserConfig } from "vitest/config";
import type { Environment } from "#naming/testName.ts";
import { TestOutput } from "./TestOutput.ts";

const EXTENSION = "?(c|m)[jt]s?(x)";

const TYPECHECK_ALONE = `**/typecheck.test.${EXTENSION}`;

function named(environment?: Environment): string {
	return environment === undefined ? `**/*.@(test|spec).${EXTENSION}` : `**/*.${environment}.@(test|spec).${EXTENSION}`;
}

function excluding(...patterns: readonly string[]): string[] {
	return [...defaultExclude, "**/.worktrees/**", named("typecheck"), TYPECHECK_ALONE, ...patterns];
}

export interface TestProjectsOptions {
	readonly connectionBudget?: number;
	readonly connectionsPerWorker?: number;
	readonly coverage?: boolean | NonNullable<TestUserConfig["coverage"]>;
	readonly maxWorkers?: number;
}

function positiveInteger(name: string, value: number): number {
	if (!Number.isSafeInteger(value) || value < 1) {
		throw new RangeError(`${name} must be a positive safe integer`);
	}
	return value;
}

function workerCount({ connectionBudget = 80, connectionsPerWorker = 14, maxWorkers }: TestProjectsOptions): number {
	if (maxWorkers !== undefined) {
		return positiveInteger("maxWorkers", maxWorkers);
	}
	return Math.max(
		1,
		Math.floor(positiveInteger("connectionBudget", connectionBudget) / positiveInteger("connectionsPerWorker", connectionsPerWorker)),
	);
}

export function testProjects(options: TestProjectsOptions = {}): TestUserConfig {
	const { coverage = false } = options;
	const output = Effect.runSync(TestOutput.pipe(Effect.provide(TestOutput.layer)));
	return {
		maxWorkers: workerCount(options),
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
		project: ["unit", "pure", "dom"],
		projects: [
			{
				extends: true,
				test: { environment: "node", exclude: excluding(named("dom"), named("slow"), named("unit")), include: [named()], name: "unit" },
			},
			{
				extends: true,
				test: {
					environment: "node",
					exclude: excluding(),
					include: [named("unit")],
					name: "pure",
					setupFiles: [fileURLToPath(import.meta.resolve("#unitIoGuard.config.ts"))],
				},
			},
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
		...output,
		// Tests that start real servers, browsers or CLIs need seconds on a busy CI runner, and Vitest's 5s default fails them for load, not behavior.
		testTimeout: 30_000,
	};
}
