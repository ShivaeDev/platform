import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { findingsBaselined } from "#test/findingsBaselined.ts";
import { biomeFormatted, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { trees } from "#test/trees.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

const LONG_FIXED = { content: "String(0);\n", path: "src/long.ts" };
const LONGER_SHRUNK = { content: "String(0);\nString(1);\nString(2);\nString(3);\nString(4);\n", path: "src/longer.ts" };
const BASELINE = "quality-baseline.jsonl";

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
