import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { repositoryTracks } from "#test/repositoryTracks.ts";
import { config } from "#test/tree.ts";

const GENERATED_IGNORED = { content: "node_modules/\nsrc/generated/\n", path: ".gitignore" };

// Each line breaks one rule family: a missing import, an inline suppression, a debugger statement, and 150 blank lines over the length limit.
const AUTHORED = {
	content: `import "./missing.ts";\n// @ts-ignore\ndebugger;\nexport const actual = 1;\n${"\n".repeat(150)}`,
	path: "src/generated/WrongFolder/badName.ts",
};
const AUTHORED_NOTES = { content: "{}", path: "src/generated/BadNotes.json" };
const OUTPUT = { content: 'import "./untracked-missing.ts";\ndebugger;', path: "src/generated/output.ts" };

const generatedFolder = [
	qualityInstalled(),
	repositoryHas(config('{ sources: ["src"] }'), GENERATED_IGNORED, AUTHORED, AUTHORED_NOTES, OUTPUT),
	repositoryTracks(AUTHORED.path, AUTHORED_NOTES.path),
];

repositoryStory.it(
	"quality lint rejects the authored files git tracks in an ignored generated folder with source, naming, suppression and Biome findings, and skips the untracked output",
	generatedFolder,
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes({
			"biome/lint/suspicious/noDebugger": [stdout(), expect.stringContaining("biome/lint/suspicious/noDebugger")],
			"exit": [outcome(), "rejected"],
			"files/folder-names": [stdout(), expect.stringContaining("files/folder-names")],
			"files/named-after-export": [stdout(), expect.stringContaining("files/named-after-export")],
			"files/other-names": [stdout(), expect.stringContaining("files/other-names")],
			"imports/resolvable": [stdout(), expect.stringContaining("imports/resolvable")],
			"structure/max-lines": [stdout(), expect.stringContaining("structure/max-lines")],
			"suppressions/no-inline": [stdout(), expect.stringContaining("suppressions/no-inline")],
			"untracked output": [stdout(), expect.not.stringContaining("untracked-missing")],
		});
	},
);

repositoryStory.it(
	"quality fix removes the debugger from an authored file git tracks in an ignored generated folder and leaves the untracked output alone",
	generatedFolder,
	function* ({ outcome, reads, runs }) {
		expect(yield* reads(AUTHORED.path)).toContain("debugger;");

		yield* runs("fix");

		yield* outcomes({
			"authored file": [reads(AUTHORED.path), expect.not.stringContaining("debugger;")],
			"exit": [outcome(), "passed"],
			"untracked output": [reads(OUTPUT.path), expect.stringContaining("debugger;")],
		});
	},
);
