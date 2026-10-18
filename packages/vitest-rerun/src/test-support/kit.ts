import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { reportVerbs } from "./reports.ts";
import { alwaysFailing, COVERED_MODULE, collectionFailingOnce, failingTimes, passing, unhandledError } from "./specFiles.ts";
import { createSuite, listFiles, REPORTS, readFile, runCli, writeFile } from "./suite.ts";

export const rerunStory = storyKit({
	clock: "live",
	create: () => createSuite,
	inspect: (suite) => ({ files: listFiles(suite), flakyTests: readFile(suite, "reports/flaky-tests.json") }),
	layer: NodeServices.layer,
	name: "vitest rerun",
	stages: ["configuration", "tests"],
	verbs: (suite, story) => ({
		files: { list: () => listFiles(suite), read: (path: string) => readFile(suite, path) },
		reports: reportVerbs(suite),
		runner: {
			run: (...args: string[]) =>
				Effect.promise(() => {
					story.tell(`vitest-rerun runs${args.length === 0 ? "" : ` with ${args.join(" ")}`}`);
					return runCli(suite, args);
				}),
		},
	}),
});

export function failsTimes(times: number, options: { readonly steadyProject?: string } = {}) {
	const steady = options.steadyProject === undefined ? "" : ` except in project ${options.steadyProject}`;
	return rerunStory.trait("tests", `a test fails ${times === 1 ? "once" : `${times} times`}${steady}, then passes`, (suite) => {
		writeFile(suite, "flaky.spec.ts", failingTimes(times, options.steadyProject));
		writeFile(suite, "covered.ts", COVERED_MODULE);
	});
}

export function alwaysFails() {
	return rerunStory.trait("tests", "a test always fails", (suite) => writeFile(suite, "broken.spec.ts", alwaysFailing));
}

export function passes() {
	return rerunStory.trait("tests", "a test passes", (suite) => {
		writeFile(suite, "passing.spec.ts", passing);
		writeFile(suite, "covered.ts", COVERED_MODULE);
	});
}

export function collectionFailsOnce() {
	return rerunStory.trait("tests", "a test file fails to load once", (suite) => writeFile(suite, "collected.spec.ts", collectionFailingOnce));
}

export function leavesUnhandledError() {
	return rerunStory.trait("tests", "a test leaves an unhandled error", (suite) => writeFile(suite, "unhandled.spec.ts", unhandledError));
}

export function staleReports() {
	return rerunStory.trait("tests", "an earlier run left reports behind", (suite) => {
		mkdirSync(join(suite.directory, REPORTS), { recursive: true });
		for (const report of ["flaky-tests.json", "tests.attempt-1.json", "tests.attempt-2.junit.xml"]) {
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
	return rerunStory.trait("configuration", "coverage is enabled", (suite) => {
		suite.config.coverage = true;
	});
}
