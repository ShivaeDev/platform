import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { LIFECYCLE_LOG } from "./lifecycleLog.ts";
import { type FixtureTest, runFixture } from "./runFixture.ts";

const FIXTURE_TESTS = {
	"a body that fails holding its resource": "scopeFixture",
	"a body that never finishes": "timeoutFixture",
	"a body that succeeds holding its resource": "scopeFixture",
	"a plain Vitest test": "testerFixture",
	"a test of a worker whose Layer fails to start": "startupFailureFixture",
	"a test waiting for its file Layer": "pendingLayerFixture",
	"a test whose cleanup never finishes": "stuckCleanupFixture",
	"an it.effect body behind a true skip condition": "testerFixture",
	"an it.effect body that fails": "testerFixture",
	"an it.effect test whose cleanup never finishes": "stuckCleanupFixture",
	"an it.live test whose cleanup never finishes": "stuckCleanupFixture",
	"it.effect.each case alpha": "testerFixture",
	"it.effect.each case beta": "testerFixture",
	"the test after a cleanup that never finishes": "stuckCleanupFixture",
	"the test after the failed worker startup": "startupFailureFixture",
} as const;

export type FixtureTestName = keyof typeof FIXTURE_TESTS;
type Fixture = (typeof FIXTURE_TESTS)[FixtureTestName] | "sharedLayerFixture";

interface VitestRun {
	readonly log: string;
	requested: readonly FixtureTestName[];
	tests: readonly FixtureTest[];
	unhandledErrors: readonly unknown[];
}

function fixtureOf(tests: readonly FixtureTestName[]): Fixture {
	const files = new Set(tests.map((test) => FIXTURE_TESTS[test]));
	const [file, ...others] = files;
	if (file === undefined || others.length > 0) {
		throw new Error(`Name tests from one fixture file, not ${[...files].join(" and ")}.`);
	}
	return file;
}

function outcomeOf({ errors, state }: FixtureTest): string {
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
		function start(file: Fixture, tests?: readonly FixtureTestName[]) {
			return Effect.promise(async () => {
				rmSync(run.log, { force: true });
				run.requested = tests ?? [];
				const result = await runFixture({
					env: { [LIFECYCLE_LOG]: run.log },
					file,
					...(tests === undefined
						? { reporter: { onTestModuleEnd: () => appendFileSync(run.log, "Vitest reported the file complete\n") } }
						: { tests }),
				});
				run.tests = result.tests;
				run.unhandledErrors = result.unhandledErrors;
			});
		}
		return {
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
			unhandledErrors: () => Effect.sync(() => run.unhandledErrors),
		};
	},
});
