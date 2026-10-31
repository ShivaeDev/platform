import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CLI_TIMEOUT, trees } from "#test/cli.ts";
import { biomeFormatted, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { config } from "#test/tree.ts";

const COMMENTED = { content: "/** Adds. */\nexport const a = 1; // TODO\n// three\n", path: "src/a.ts" };

const UNRUNNABLE = [
	["a config that does not parse", [{ content: "export default {", path: "quality.config.ts" }], "cannot load"],
	[
		"a config that names an unknown rule",
		[config('{ rules: { "structure/max-line": "error" } }')],
		"rules.structure/max-line: no built-in or local rule has this id",
	],
	["a source folder that does not exist", [config('{ sources: ["srcc"] }')], 'source "srcc" does not exist'],
	["a baseline that is not JSON Lines", [config("{}"), { content: "[]", path: "quality-baseline.jsonl" }], "quality-baseline.jsonl is invalid"],
	[
		"only a baseline in the earlier format",
		[config("{}"), { content: "{}\n", path: "quality/baseline.json" }],
		"Run `quality baseline migrate --from quality/baseline.json` to move it to quality-baseline.jsonl",
	],
	[
		"a local rule whose check throws",
		[
			config(
				'{ local: [{ id: "local/boom", description: "Throws.", configure: async () => ({ _tag: "Ready", check: () => { throw new Error("boom"); } }) }] }',
			),
		],
		"rule local/boom failed: boom",
	],
] as const;

repositoryStory.it(
	"quality lint passes a tree whose only long files are a declaration and a file .gitignore lists, and counts the sources it checked",
	[qualityInstalled(), repositoryHas(...trees.clean), biomeFormatted()],
	function* ({ outcome, runs, stderr, stdout }) {
		yield* runs("lint");

		yield* outcomes([
			["error output", () => stderr(), ""],
			["exit", () => outcome(), "passed"],
			["report", () => stdout(), "quality: passed. 3 source files checked.\n"],
		]);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"the quality executable rejects two files over the line limit under one structure/max-lines heading with a line each",
	[qualityInstalled(), repositoryHas(...trees.dirty), biomeFormatted()],
	function* ({ outcome, spawns, stderr, stdout }) {
		yield* spawns("lint");

		yield* outcomes([
			["error output", () => stderr(), ""],
			["exit", () => outcome(), "rejected"],
			["heading", () => stdout(), expect.stringContaining("error structure/max-lines (2)\n")],
			["long file", () => stdout(), expect.stringContaining("  src/long.ts  4 lines exceeds the 3-line limit.")],
			["longer file", () => stdout(), expect.stringContaining("  src/longer.ts  6 lines exceeds the 3-line limit.")],
			["summary", () => stdout(), expect.stringContaining("quality: failed with 2 errors.")],
		]);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality lint without rule settings rejects a JSDoc block, a TODO and a third comment, each at its own line",
	[repositoryHas(config('{ sources: ["src"] }'), COMMENTED)],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes([
			["comment count", () => stdout(), expect.stringContaining("  src/a.ts:3  3 comments against a limit of 2.")],
			["exit", () => outcome(), "rejected"],
			["JSDoc", () => stdout(), expect.stringContaining("  src/a.ts:1  JSDoc block.")],
			["TODO", () => stdout(), expect.stringContaining('  src/a.ts:2  Marks unfinished work: "TODO".')],
		]);
	},
	CLI_TIMEOUT,
);

for (const [setup, files, explanation] of UNRUNNABLE) {
	repositoryStory.it(
		`quality lint cannot run with ${setup}, so it prints no report and explains "${explanation}"`,
		[repositoryHas(...files)],
		function* ({ outcome, runs, stderr, stdout }) {
			yield* runs("lint");

			yield* outcomes([
				["error", () => stderr(), expect.stringContaining(explanation)],
				["exit", () => outcome(), "invalid"],
				["report", () => stdout(), ""],
			]);
		},
		CLI_TIMEOUT,
	);
}

repositoryStory.it(
	"quality lint refuses an unknown option, names it and prints the usage",
	[],
	function* ({ outcome, runs, stderr }) {
		yield* runs("lint", "--warnings", "all");

		yield* outcomes([
			["error", () => stderr(), expect.stringContaining("Unknown option '--warnings'")],
			["exit", () => outcome(), "invalid"],
			["usage", () => stderr(), expect.stringContaining("Usage:\n  quality lint [--config <file>]")],
		]);
	},
	CLI_TIMEOUT,
);
