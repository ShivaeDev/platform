import { expect } from "vitest";
import { importsResolvable } from "#rules/imports/resolvable.ts";
import { fixtureTree } from "#test/fixtureTree.ts";
import { gitTracks, importStory, repositoryHas, repositoryHolds } from "#test/importStory.ts";

const UNRESOLVABLE = repositoryHolds(fixtureTree("unresolvable"));

const OTHER_UNRESOLVED = [
	"./gone.ts",
	"left-pad",
	"../dist/does-not-exist.ts",
	"./node_modules/ghost/index.ts",
	"./missing.css",
	"other:thing",
	"augmented",
	"./ghost.ts",
	"hast",
	"dts-only",
	"./ghost.css",
];

importStory.it(
	"imports/resolvable takes a missing file under a declared generated folder as resolved and still reports every other unresolved import",
	[UNRESOLVABLE],
	function* ({ check, subjects }) {
		yield* check(importsResolvable);
		expect(yield* subjects()).toContain("./generated/client.ts");

		yield* check(importsResolvable, { generated: ["src/generated"] });

		expect(yield* subjects()).toEqual(OTHER_UNRESOLVED);
	},
);

importStory.it(
	"imports/resolvable takes a missing file that a package import names in a declared generated folder as resolved, and reports one in an undeclared folder",
	[repositoryHolds(fixtureTree("generatedAlias"))],
	function* ({ check, sites }) {
		yield* check(importsResolvable, { generated: ["test/generated"] });

		expect(yield* sites()).toEqual(["test/client.test.ts:2 #test/cache/client.ts"]);
	},
);

importStory.it(
	"imports/resolvable takes a generated folder that git keeps with a placeholder while ignoring its contents",
	[
		UNRESOLVABLE,
		repositoryHas({ content: "src/generated/*\n!src/generated/.gitkeep\n", path: ".gitignore" }, { content: "", path: "src/generated/.gitkeep" }),
		gitTracks("src/generated/.gitkeep"),
	],
	function* ({ check, subjects }) {
		yield* check(importsResolvable, { generated: ["src/generated"] });

		expect(yield* subjects()).toEqual(OTHER_UNRESOLVED);
	},
);

importStory.it(
	"imports/resolvable refuses generated folders under node_modules, outside git's ignores and named by no import, naming each problem",
	[UNRESOLVABLE],
	function* ({ refusal }) {
		expect(yield* refusal(importsResolvable, { generated: ["src/node_modules/ghost", "src", "src/generated/unused"] })).toBe(
			[
				"the generated folders are invalid:",
				'  - "src/node_modules/ghost" lies in node_modules, which holds installed packages, not generated output',
				'  - "src" is not ignored by git, so it holds source, not generated output',
				'  - "src/generated/unused" holds no file that an import names',
			].join("\n"),
		);
	},
);

for (const [folder, normalized] of [
	["./", ""],
	["../generated", "../generated"],
	["/generated", "/generated"],
] as const) {
	importStory.it(`imports/resolvable refuses the generated folder "${folder}" outside the repository`, [UNRESOLVABLE], function* ({ refusal }) {
		expect(yield* refusal(importsResolvable, { generated: [folder] })).toContain(`"${normalized}" is no folder inside the repository`);
	});
}

importStory.it(
	"imports/resolvable refuses a generated folder that holds files git tracks, naming one",
	[UNRESOLVABLE, repositoryHas({ content: "export const kept = 1;\n", path: "src/generated/kept.ts" }), gitTracks("src/generated/kept.ts")],
	function* ({ refusal }) {
		expect(yield* refusal(importsResolvable, { generated: ["src/generated"] })).toContain(
			'"src/generated" holds files git tracks, such as src/generated/kept.ts, so it is not generated output',
		);
	},
);
