import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CLI_TIMEOUT, trees } from "#test/cli.ts";
import { findingsBaselined } from "#test/findingsBaselined.ts";
import { biomeFormatted, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";

const REGISTRY = {
	content: JSON.stringify([
		{ file: "src/long.ts", reason: "Generated from the schema.", rule: "structure/max-lines" },
		{ file: "src/longer.ts", reason: "Generated from the schema.", rule: "structure/max-lines" },
	]),
	path: "quality/registry.json",
};
const LONG_FIXED = { content: "String(0);\n", path: "src/long.ts" };
const LONGER_SHRUNK = { content: "String(0);\nString(1);\nString(2);\nString(3);\nString(4);\n", path: "src/longer.ts" };
const LONGER_GROWN = { content: "String(0);\nString(1);\nString(2);\nString(3);\nString(4);\nString(5);\nString(6);\n", path: "src/longer.ts" };
const BASELINE = "quality-baseline.jsonl";

repositoryStory.it(
	"quality lint passes when the registry covers every finding and counts the registered findings",
	[qualityInstalled(), repositoryHas(...trees.dirty, REGISTRY), biomeFormatted()],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes([
			["exit", () => outcome(), "passed"],
			["report", () => stdout(), expect.stringContaining("quality: passed. 3 source files checked; 2 registered violations not shown.")],
		]);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"once the author fixes a registered file, quality lint rejects its registry entry as matching no violation",
	[qualityInstalled(), repositoryHas(...trees.dirty, REGISTRY), biomeFormatted()],
	function* ({ runs, writes }) {
		expect((yield* runs("lint")).outcome).toBe("passed");

		yield* writes(LONG_FIXED);

		expect(yield* runs("lint")).toMatchObject({
			outcome: "rejected",
			stdout: expect.stringContaining("structure/max-lines src/long.ts matches no violation."),
		});
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality baseline write records an entry with the excess lines of each file over the limit",
	[qualityInstalled(), repositoryHas(...trees.dirty), biomeFormatted()],
	function* ({ outcome, reads, runs, stdout }) {
		expect(yield* reads(BASELINE)).toBeUndefined();

		yield* runs("baseline", "write");

		yield* outcomes([
			[
				"baseline",
				() => reads(BASELINE),
				'{"path":"src/long.ts","rule":"structure/max-lines","count":1}\n{"path":"src/longer.ts","rule":"structure/max-lines","count":3}\n',
			],
			["exit", () => outcome(), "passed"],
			["report", () => stdout(), "quality: recorded 2 entries in quality-baseline.jsonl.\n"],
		]);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality lint passes baselined findings and counts them as not shown",
	[qualityInstalled(), repositoryHas(...trees.dirty), biomeFormatted(), findingsBaselined()],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes([
			["exit", () => outcome(), "passed"],
			["report", () => stdout(), expect.stringContaining("2 baselined violations not shown")],
		]);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"once a baselined file grows, quality lint rejects it and names its count against the baselined one",
	[qualityInstalled(), repositoryHas(...trees.dirty), biomeFormatted(), findingsBaselined()],
	function* ({ runs, writes }) {
		expect((yield* runs("lint")).outcome).toBe("passed");

		yield* writes(LONGER_GROWN);

		expect(yield* runs("lint")).toMatchObject({
			outcome: "rejected",
			stdout: expect.stringContaining("src/longer.ts is over its baseline: 4 against 3 baselined."),
		});
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"once baselined files shrink, quality lint still passes and notes the entries that allow more than is left",
	[qualityInstalled(), repositoryHas(...trees.dirty), biomeFormatted(), findingsBaselined()],
	function* ({ outcome, runs, stdout, writes }) {
		expect(yield* runs("lint")).toMatchObject({ outcome: "passed", stdout: expect.not.stringContaining("note") });

		yield* writes(LONG_FIXED, LONGER_SHRUNK);

		yield* runs("lint");
		yield* outcomes([
			["exit", () => outcome(), "passed"],
			["fixed file", () => stdout(), expect.stringContaining("structure/max-lines src/long.ts has no violations left.")],
			["note", () => stdout(), expect.stringContaining("note quality-baseline.jsonl: 2 stale entries")],
			["shrunk file", () => stdout(), expect.stringContaining("structure/max-lines src/longer.ts allows more than is left")],
		]);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality baseline prune removes the entry of a fixed file and lowers the entry of a shrunk one",
	[qualityInstalled(), repositoryHas(...trees.dirty), biomeFormatted(), findingsBaselined()],
	function* ({ reads, runs, stdout, writes }) {
		yield* writes(LONG_FIXED, LONGER_SHRUNK);
		expect(yield* reads(BASELINE)).toContain('{"path":"src/long.ts"');

		yield* runs("baseline", "prune");

		yield* outcomes([
			["baseline", () => reads(BASELINE), '{"path":"src/longer.ts","rule":"structure/max-lines","count":2}\n'],
			["report", () => stdout(), "quality: removed 1 entry and lowered 1 entry in quality-baseline.jsonl.\n"],
		]);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality baseline write refuses to replace an existing baseline unless the author names a rule",
	[qualityInstalled(), repositoryHas(...trees.dirty, { content: "", path: BASELINE }), biomeFormatted()],
	function* ({ outcome, runs, stderr }) {
		yield* runs("baseline", "write");

		yield* outcomes([
			["error", () => stderr(), expect.stringContaining("a baseline exists. Record a rule with --rule <id>")],
			["exit", () => outcome(), "invalid"],
		]);
	},
	CLI_TIMEOUT,
);
