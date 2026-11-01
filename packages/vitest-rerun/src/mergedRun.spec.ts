import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { pendingRerun, rerunLeavesUnhandledError, snapshotsAcrossAttempts } from "#test/agreementTraits.ts";
import { failsTimes, passes, rerunStory, withCoverage } from "#test/kit.ts";

rerunStory.it("interrupting a pending rerun removes its attempt snapshots", [pendingRerun()], function* ({ interruptRun, reports, startRun }) {
	yield* startRun();
	expect(yield* reports()).toContain("tests.attempt-1.bin");

	yield* interruptRun();

	expect((yield* reports()).filter((file) => file.endsWith(".bin"))).toEqual([]);
});

rerunStory.it(
	"coverage thresholds pass when the merged run covers every function, though neither attempt does",
	[withCoverage(100), failsTimes(1), passes()],
	function* ({ coveredFunctions, exitCode, run }) {
		yield* run();

		yield* outcomes([
			["exit code", () => exitCode(), 0],
			["covered functions", () => coveredFunctions(), ["alsoCovered", "covered"]],
		]);
	},
);

rerunStory.it(
	"coverage thresholds fail when the merged run leaves a function uncovered after a test recovers",
	[withCoverage(100), failsTimes(1)],
	function* ({ exitCode: readExitCode, run }) {
		yield* run();

		const exitCode = yield* readExitCode();
		expect(exitCode).toBe(1);
	},
);

rerunStory.it(
	"an unhandled error occurring only in the rerun fails the run and stays in the final JUnit",
	[rerunLeavesUnhandledError()],
	function* ({ exitCode, reportContents, run }) {
		yield* run();

		yield* outcomes([
			["exit code", () => exitCode(), 1],
			["final JUnit", () => reportContents("tests.junit.xml"), expect.stringContaining("Unhandled rerun error")],
		]);
	},
);

rerunStory.it(
	"the final JSON keeps snapshot totals from the first attempt through two reruns",
	[snapshotsAcrossAttempts()],
	function* ({ jsonSnapshotTotals, run }) {
		yield* run("--reruns", "2");

		expect(yield* jsonSnapshotTotals()).toEqual({ matched: 3, total: 3 });
	},
);

rerunStory.it(
	"the final JSON coverage map keeps functions covered in either attempt",
	[withCoverage(), failsTimes(1), passes()],
	function* ({ jsonCoveredFunctions, run }) {
		yield* run();

		expect(yield* jsonCoveredFunctions()).toEqual(["alsoCovered", "covered"]);
	},
);
