import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { baselineStory } from "#test/baselineStory.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { branchedFromMain, debtRecorded, deletedWithGit, shortened, staged } from "#test/debtRecorded.ts";

const RECORDED = ["src/long.ts structure/max-lines 1", "src/longer.ts structure/max-lines 3"];

baselineStory.it(
	"baseline tighten --staged removes the fixed entry of a staged file and leaves the entry of an unstaged file that shrank",
	[debtRecorded(), branchedFromMain(), shortened("src/long.ts", 1), shortened("src/longer.ts", 5), staged("src/long.ts")],
	function* ({ recorded, runs, stdout }) {
		expect(yield* recorded()).toEqual(RECORDED);

		yield* runs("baseline", "tighten", "--staged");

		yield* outcomes([
			["recorded debt", () => recorded(), ["src/longer.ts structure/max-lines 3"]],
			["report", () => stdout(), "quality: removed 1 entry and lowered 0 entries in quality-baseline.jsonl.\n"],
		]);
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"baseline tighten without --staged removes and lowers the entries of every file changed since HEAD",
	[debtRecorded(), branchedFromMain(), shortened("src/long.ts", 1), shortened("src/longer.ts", 5)],
	function* ({ recorded, runs, stdout }) {
		expect(yield* recorded()).toEqual(RECORDED);

		yield* runs("baseline", "tighten");

		yield* outcomes([
			["recorded debt", () => recorded(), ["src/longer.ts structure/max-lines 2"]],
			["report", () => stdout(), "quality: removed 1 entry and lowered 1 entry in quality-baseline.jsonl.\n"],
		]);
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"baseline tighten --staged removes the entry of a file deleted with git rm",
	[debtRecorded(), branchedFromMain(), deletedWithGit("src/longer.ts")],
	function* ({ recorded, runs, stdout }) {
		expect(yield* recorded()).toEqual(RECORDED);

		yield* runs("baseline", "tighten", "--staged");

		yield* outcomes([
			["recorded debt", () => recorded(), ["src/long.ts structure/max-lines 1"]],
			["report", () => stdout(), "quality: removed 1 entry and lowered 0 entries in quality-baseline.jsonl.\n"],
		]);
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"baseline tighten --staged with nothing staged reports the baseline as current",
	[debtRecorded(), branchedFromMain()],
	function* ({ runs, stdout }) {
		yield* runs("baseline", "tighten", "--staged");

		expect(yield* stdout()).toBe("quality: quality-baseline.jsonl is current.\n");
	},
	CLI_TIMEOUT,
);
