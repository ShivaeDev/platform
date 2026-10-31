import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { MAX_FIX_ROUNDS } from "#cli/fix.ts";
import { fixPassKeepsRewriting, fixPassReports, fixRounds, formatPassRestores, repositoryHas } from "#test/fixRounds.ts";

const FLIP = { content: "export const flip = 1;\n", path: "src/flip.ts" };
const STILL = { content: "export const still = 1;\n", path: "src/still.ts" };
const IGNORED = [
	{ content: "dist/\n", path: ".gitignore" },
	{ content: "export const out = 1;\n", path: "dist/out.js" },
];
const LOGO = { content: "\u0089PNG\r\n\u001a\n\u0000\u0000\u0000\rIHDR", path: "assets/logo.png" };
const STOPPED = "Biome still rewrote files after 5 rounds, so quality fix stopped.";
const REPAIR = "Two fixes probably undo each other there. Repair the conflicting code by hand so both checks pass.";

fixRounds.it("quality fix settles after the first Biome round that rewrites nothing", [fixPassReports(3, 1)], function* ({ fixes, outcome, rounds }) {
	yield* fixes();

	yield* outcomes({
		"fix": [outcome(), "settled"],
		"rounds": [
			rounds(),
			[
				"quality: Biome round 1 rewrote 3 files with fixes and 0 files with the format pass.",
				"quality: Biome round 2 rewrote 1 file with fixes and 0 files with the format pass.",
				"quality: Biome round 3 rewrote 0 files with fixes and 0 files with the format pass.",
			],
		],
	});
});

fixRounds.it(
	"quality fix stops after five rounds of rewrites and names only the file the last round changed",
	[repositoryHas(FLIP, STILL), fixPassKeepsRewriting(FLIP.path)],
	function* ({ failure, fixes, outcome, rounds }) {
		yield* fixes();

		yield* outcomes({
			"failure": [failure(), [`${STOPPED} These files changed in the last round:`, "  src/flip.ts", REPAIR].join("\n")],
			"fix": [outcome(), "stopped"],
			"rounds": [
				rounds(),
				Array.from(
					{ length: MAX_FIX_ROUNDS },
					(_, index) => `quality: Biome round ${index + 1} rewrote 1 file with fixes and 0 files with the format pass.`,
				),
			],
		});
	},
);

fixRounds.it(
	"quality fix names a file that the fix pass rewrites and the format pass restores within each round",
	[repositoryHas(FLIP), fixPassKeepsRewriting(FLIP.path), formatPassRestores(FLIP.path)],
	function* ({ failure, fixes }) {
		yield* fixes();

		expect(yield* failure()).toBe([`${STOPPED} These files changed in the last round:`, "  src/flip.ts", REPAIR].join("\n"));
	},
);

fixRounds.it(
	"quality fix leaves a binary file out of the files it names",
	[repositoryHas(LOGO, FLIP), fixPassKeepsRewriting(LOGO.path, FLIP.path)],
	function* ({ failure, fixes }) {
		yield* fixes();

		expect(yield* failure()).toBe([`${STOPPED} These files changed in the last round:`, "  src/flip.ts", REPAIR].join("\n"));
	},
);

fixRounds.it(
	"quality fix says how to find the files when Biome keeps rewriting only a file .gitignore lists",
	[repositoryHas(...IGNORED), fixPassKeepsRewriting("dist/out.js")],
	function* ({ failure, fixes }) {
		yield* fixes();

		expect(yield* failure()).toBe(
			[
				`${STOPPED} The files it changed in the last round are ones quality fix does not read, such as files .gitignore lists.`,
				"Run `biome check --write --unsafe --verbose` to name them.",
				REPAIR,
			].join("\n"),
		);
	},
);
