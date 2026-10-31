import { expect } from "vitest";
import { baselineStory } from "#test/baselineStory.ts";
import { boundaryDebt, THROW } from "#test/boundaryDebt.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { branchedFromMain, debtRecorded, shortened, staged } from "#test/debtRecorded.ts";

baselineStory.it(
	"pre-commit requires fixed debt to be tightened before a new finding can reuse its count",
	[boundaryDebt()],
	function* ({ outcome, recorded, runs, stages, stdout, writes }) {
		yield* writes("src/work.ts", "String(0);\n");
		yield* stages("src/work.ts");
		yield* runs("hooks", "pre-commit");
		expect(yield* outcome()).toBe("rejected");
		expect(yield* stdout()).toContain("effect/boundary src/work.ts has no violations left");

		yield* runs("baseline", "tighten", "--staged");
		expect(yield* recorded()).toBe("no baseline file");
		yield* runs("hooks", "pre-commit");
		expect(yield* outcome()).toBe("rejected");

		yield* stages("quality-baseline.jsonl");
		yield* runs("hooks", "pre-commit");
		expect(yield* outcome()).toBe("passed");

		yield* writes("src/work.ts", THROW);
		yield* stages("src/work.ts");
		yield* runs("hooks", "pre-commit");
		expect(yield* outcome()).toBe("rejected");
		expect(yield* stdout()).toContain("throw");
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"tightening staged repairs leaves unrelated loose entries in the same shard alone",
	[debtRecorded(), branchedFromMain(), shortened("src/long.ts", 1), staged("src/long.ts"), shortened("src/longer.ts", 5)],
	function* ({ outcome, recorded, runs, stages }) {
		yield* runs("baseline", "tighten", "--staged");
		yield* stages("quality-baseline.jsonl");
		yield* runs("hooks", "pre-commit");

		expect(yield* outcome()).toBe("passed");
		expect(yield* recorded()).toEqual(["src/longer.ts structure/max-lines 3"]);
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"pre-commit rejects an inflated staged baseline even when no source file is staged",
	[debtRecorded(), branchedFromMain()],
	function* ({ outcome, runs, stages, stdout, writes }) {
		yield* writes(
			"quality-baseline.jsonl",
			'{"path":"src/long.ts","rule":"structure/max-lines","count":1}\n{"path":"src/longer.ts","rule":"structure/max-lines","count":4}\n',
		);
		yield* stages("quality-baseline.jsonl");
		yield* runs("hooks", "pre-commit");

		expect(yield* outcome()).toBe("rejected");
		expect(yield* stdout()).toContain("src/longer.ts allows more than is left: 3 against 4 baselined");
	},
	CLI_TIMEOUT,
);
