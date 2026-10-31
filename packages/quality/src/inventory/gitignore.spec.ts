import { expect } from "vitest";
import { gitTracks, inventoryStory, repositoryHas } from "#test/inventoryStory.ts";

const GITIGNORES = [
	{ content: ".worktree/\nbuild/\n*.scratch.ts\n", path: ".gitignore" },
	{ content: "generated/*\n!generated/keep.ts\n", path: "packages/y/.gitignore" },
	{ content: "!build/\n", path: "packages/z/.gitignore" },
];

// git check-ignore sorts these paths against the .gitignore files above.
const IGNORED = ["packages/x/.worktree/scratch.ts", "packages/y/generated/drop.ts", "packages/z/build/a.scratch.ts", "packages/w/build/drop.ts"];
const KEPT = ["packages/x/src/mod.ts", "packages/y/generated/keep.ts", "packages/z/build/keep.ts", "packages/z/build/sub/deep.ts"];

const IGNORED_FILES = IGNORED.map((path) => ({ content: "export const value = 1;\n", path }));
const KEPT_FILES = KEPT.map((path) => ({ content: "export const value = 1;\n", path }));

inventoryStory.it(
	"the inventory leaves out the files that .gitignore files ignore once the author adds them",
	[repositoryHas(...IGNORED_FILES, ...KEPT_FILES)],
	function* ({ collects, sourcePaths, writes }) {
		yield* collects({ extensions: [".ts"] });
		expect(yield* sourcePaths()).toEqual([
			"packages/w/build/drop.ts",
			"packages/x/.worktree/scratch.ts",
			"packages/x/src/mod.ts",
			"packages/y/generated/drop.ts",
			"packages/y/generated/keep.ts",
			"packages/z/build/a.scratch.ts",
			"packages/z/build/keep.ts",
			"packages/z/build/sub/deep.ts",
		]);

		yield* writes(...GITIGNORES);
		yield* collects({ extensions: [".ts"] });

		expect(yield* sourcePaths()).toEqual(KEPT);
	},
);

inventoryStory.it(
	"the inventory applies the .gitignore files above a nested source folder",
	[repositoryHas(...GITIGNORES, ...IGNORED_FILES, ...KEPT_FILES)],
	function* ({ collects, sourcePaths }) {
		yield* collects({ extensions: [".ts"], sources: ["packages/y", "packages/w"] });

		expect(yield* sourcePaths()).toEqual(["packages/y/generated/keep.ts"]);
	},
);

inventoryStory.it(
	"the inventory leaves out node_modules without a .gitignore",
	[
		repositoryHas(
			{ content: "export const k = 1;\n", path: "packages/x/src/mod.ts" },
			{ content: "export const v = 1;\n", path: "packages/x/node_modules/v/index.ts" },
		),
	],
	function* ({ collects, sourcePaths }) {
		yield* collects();

		expect(yield* sourcePaths()).toEqual(["packages/x/src/mod.ts"]);
	},
);

const GENERATED = [
	{ content: "generated/\n", path: ".gitignore" },
	{ content: "export const authored = 1;", path: "src/generated/Nested/authored.ts" },
	{ content: "!output.ts\n", path: "src/generated/Nested/.gitignore" },
	{ content: "export const output = 1;", path: "src/generated/Nested/output.ts" },
	{ content: "export const loose = 1;", path: "src/generated/loose.ts" },
];

for (const source of [".", "src/generated", "src/generated/Nested"]) {
	inventoryStory.it(
		`the inventory of the source ${source} keeps a file git tracks in an ignored folder and leaves out the untracked files beside it`,
		[repositoryHas(...GENERATED), gitTracks("src/generated/Nested/authored.ts")],
		function* ({ collects, sourcePaths }) {
			yield* collects({ sources: [source] });

			expect(yield* sourcePaths()).toEqual(["src/generated/Nested/authored.ts"]);
		},
	);
}
