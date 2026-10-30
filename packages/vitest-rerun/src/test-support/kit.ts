import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { reportReadouts } from "./reports.ts";
import {
	alwaysFailing,
	BESIDE,
	COVERED_MODULE,
	collectionFailingOnce,
	FLAKY,
	failingThenSkipped,
	failingTimes,
	gainingTest,
	losingTest,
	passing,
	unhandledError,
} from "./specFiles.ts";
import { createSuite, listFiles, REPORTS, readFile, runProgram, spawnCli, writeFile } from "./suite.ts";

function withArgs(args: readonly string[]): string {
	return args.length === 0 ? "" : ` with ${args.join(" ")}`;
}

export const rerunStory = storyKit({
	clock: "live",
	create: () => createSuite,
	inspect: (suite) => ({
		exitCodes: suite.runs.map((run) => run.exitCode),
		files: listFiles(suite),
		flakyTests: readFile(suite, `${REPORTS}/flaky-tests.json`),
	}),
	layer: NodeServices.layer,
	name: "vitest rerun",
	stages: ["configuration", "tests"],
	verbs: (suite, story) => ({
		...reportReadouts(suite),
		run: (...args: string[]) => {
			story.tell(`vitest-rerun runs${withArgs(args)}`);
			return runProgram(suite, args);
		},
		runExecutable: (...args: string[]) =>
			Effect.promise(() => {
				story.tell(`the vitest-rerun executable runs in its own process${withArgs(args)}`);
				return spawnCli(suite, args);
			}),
	}),
});

export function failsTimes(times: number, options: { readonly steadyProject?: string } = {}) {
	const attempts = times === 1 ? "its first attempt" : `its first ${times} attempts`;
	const steady = options.steadyProject === undefined ? "" : `, except in project ${options.steadyProject}, where it passes at once`;
	return rerunStory.trait(
		"tests",
		`in flaky.spec.ts, "${FLAKY}" fails ${attempts} and passes only in a fresh process${steady}, beside "${BESIDE}", which passes`,
		(suite) => {
			writeFile(suite, "flaky.spec.ts", failingTimes(times, options.steadyProject));
			writeFile(suite, "covered.ts", COVERED_MODULE);
		},
	);
}

export function alwaysFails() {
	return rerunStory.trait("tests", 'in broken.spec.ts, "stays broken" fails in every attempt', (suite) =>
		writeFile(suite, "broken.spec.ts", alwaysFailing),
	);
}

export function passes() {
	return rerunStory.trait("tests", 'in passing.spec.ts, "passes" passes', (suite) => {
		writeFile(suite, "passing.spec.ts", passing);
		writeFile(suite, "covered.ts", COVERED_MODULE);
	});
}

export function collectionFailsOnce() {
	return rerunStory.trait("tests", 'collected.spec.ts fails to load in the first attempt, then holds "passes once collected"', (suite) =>
		writeFile(suite, "collected.spec.ts", collectionFailingOnce),
	);
}

export function leavesUnhandledError() {
	return rerunStory.trait("tests", "a test in unhandled.spec.ts throws an unhandled error from a timer", (suite) =>
		writeFile(suite, "unhandled.spec.ts", unhandledError),
	);
}

export const STALE_REPORTS = ["flaky-tests.json", "tests.attempt-1.json", "tests.attempt-2.junit.xml"];

export function staleReports() {
	return rerunStory.trait("tests", `an earlier run left ${STALE_REPORTS.join(", ")} in the output directory`, (suite) => {
		mkdirSync(join(suite.directory, REPORTS), { recursive: true });
		for (const report of STALE_REPORTS) {
			writeFile(suite, `${REPORTS}/${report}`, "stale");
		}
	});
}

export function inProjects(...projects: string[]) {
	return rerunStory.trait("configuration", `every test runs in the projects ${projects.join(" and ")}`, (suite) => {
		suite.config.projects = projects;
	});
}

export function withCoverage() {
	return rerunStory.trait(
		"configuration",
		`coverage is enabled for covered.ts, whose covered() only "${FLAKY}" calls once it passes and whose alsoCovered() only "passes" calls`,
		(suite) => {
			suite.config.coverage = true;
		},
	);
}

export function failsThenSkipped() {
	return rerunStory.trait("tests", 'in skipped.spec.ts, "is skipped by the rerun" fails in the first attempt and is skipped in the rerun', (suite) =>
		writeFile(suite, "skipped.spec.ts", failingThenSkipped),
	);
}

export function gainsTest() {
	return rerunStory.trait(
		"tests",
		'in gaining.spec.ts, "fails first" fails in the first attempt, and the rerun collects a new test, "appears in the rerun"',
		(suite) => writeFile(suite, "gaining.spec.ts", gainingTest),
	);
}

export function losesTest() {
	return rerunStory.trait(
		"tests",
		'in losing.spec.ts, "disappears in the rerun" fails in the first attempt and the rerun no longer collects it, beside "stays", which passes',
		(suite) => writeFile(suite, "losing.spec.ts", losingTest),
	);
}
