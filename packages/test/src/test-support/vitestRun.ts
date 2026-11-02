import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { runVitest, type VitestTest } from "#adapters/runVitest.ts";
import { type Fixture, type FixtureTestName, fixtureOf, type TesterVariant } from "./fixtures.ts";
import { LIFECYCLE_LOG } from "./lifecycleLog.ts";

interface VitestRun {
	readonly log: string;
	requested: readonly FixtureTestName[];
	tests: readonly VitestTest[];
	unhandledErrors: readonly unknown[];
}

function outcomeOf({ errors, state }: VitestTest): string {
	return state === "failed" ? `failed: ${errors.map((error) => error.split("\n")[0]).join(" / ")}` : state;
}

export const vitestRun = storyKit({
	clock: "live",
	*create() {
		const directory = yield* Effect.acquireRelease(
			Effect.sync(() => mkdtempSync(join(tmpdir(), "test-vitest-run-"))),
			(path) => Effect.sync(() => rmSync(path, { force: true, recursive: true })),
		);
		const run: VitestRun = { log: join(directory, "lifecycle.log"), requested: [], tests: [], unhandledErrors: [] };
		return run;
	},
	inspect: ({ requested, tests }) =>
		tests.filter(({ name }) => requested.some((test) => test === name)).map((test) => `${test.name}: ${outcomeOf(test)}`),
	name: "Vitest run",
	stages: [],
	verbs: (run, story) => {
		function start(file: Fixture, tests?: readonly FixtureTestName[], variant?: TesterVariant) {
			return Effect.gen(function* () {
				rmSync(run.log, { force: true });
				run.requested = tests ?? [];
				const result = yield* runVitest({
					allowOnly: variant === "only",
					env: { [LIFECYCLE_LOG]: run.log, ...(variant === undefined ? {} : { "TESTER_VARIANT": variant }) },
					include: `src/test-support/${file}.ts`,
					root: fileURLToPath(new URL("../..", import.meta.url)),
					...(tests === undefined && variant === undefined
						? { reporter: { onTestModuleEnd: () => appendFileSync(run.log, "Vitest reported the file complete\n") } }
						: {}),
					...(tests === undefined ? {} : { tests }),
				});
				if (result.moduleErrors.length > 0) {
					throw new Error(`The fixture ${file} did not load: ${result.moduleErrors.join("\n")}`);
				}
				run.tests = result.tests;
				run.unhandledErrors = result.unhandledErrors;
			});
		}
		return {
			bodyOutcomes: () => Effect.sync(() => run.tests.map(({ name, state }) => ({ name, state }))),
			errorNames: (name: FixtureTestName) => Effect.sync(() => run.tests.find((test) => test.name === name)?.errorNames),
			lifecycle: () => Effect.sync(() => (existsSync(run.log) ? readFileSync(run.log, "utf8").trimEnd().split("\n") : [])),
			outcome: (name?: FixtureTestName) =>
				Effect.sync(() => {
					const [only, ...others] = run.requested;
					const wanted = name ?? (others.length === 0 ? only : undefined);
					const test = run.tests.find((candidate) => candidate.name === wanted);
					if (test === undefined) {
						throw new Error(wanted === undefined ? "Name the test whose outcome to read." : `The last run has no test named "${wanted}".`);
					}
					return outcomeOf(test);
				}),
			runs: (...tests: readonly [FixtureTestName, ...FixtureTestName[]]) => {
				story.tell(`Vitest runs ${tests.map((test) => `"${test}"`).join(", then ")}`);
				return start(fixtureOf(tests), tests);
			},
			runsPendingLayerFile: () => {
				story.tell("Vitest runs a test that times out waiting for its file Layer, and reports when the file is complete");
				return start("pendingLayerFixture");
			},
			runsSharedLayerFile: () => {
				story.tell("Vitest runs a file whose two tests use one file Layer, and reports when the file is complete");
				return start("sharedLayerFixture");
			},
			runsVariant: (variant: TesterVariant) => {
				story.tell(`Vitest runs generator and Effect bodies through ${variant} on fixture, effect and live testers`);
				return start("variantFixture", undefined, variant);
			},
			unhandledErrors: () => Effect.sync(() => run.unhandledErrors),
		};
	},
});
