import { importsResolvable } from "#rules/imports/resolvable.ts";
import { definedModuleWorkspace, NOTES_GENERATED } from "#test/definedModules.ts";
import { fixtureTree } from "#test/fixtureTree.ts";
import { gitTracks, importStory, repositoryHas, repositoryHolds } from "#test/importStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

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
		yield* assertThat(yield* subjects(), (actual) => actual.toContain("./generated/client.ts"));

		yield* check(importsResolvable, { generated: ["src/generated"] });

		yield* assertThat(yield* subjects(), (actual) => actual.toEqual(OTHER_UNRESOLVED));
	},
);

importStory.it(
	"imports/resolvable takes a missing file that a package import names in a declared generated folder as resolved, and reports one in an undeclared folder",
	[repositoryHolds(fixtureTree("generatedAlias"))],
	function* ({ check, sites }) {
		yield* check(importsResolvable, { generated: ["test/generated"] });

		yield* assertThat(yield* sites(), (actual) => actual.toEqual(["test/client.test.ts:2 #test/cache/client.ts"]));
	},
);

importStory.it(
	"imports/resolvable takes another workspace package's import of a missing file in a declared generated folder as resolved, and reports one in an undeclared folder",
	[
		...definedModuleWorkspace,
		repositoryHas({
			content: 'import { Draft } from "@acme/notes/drafts/Draft.ts";\n\nexport const draft = Draft;\n',
			path: "packages/ui/src/drafts.ts",
		}),
	],
	function* ({ check, sites }) {
		yield* check(importsResolvable, { generated: [NOTES_GENERATED] });

		yield* assertThat(yield* sites(), (actual) => actual.toEqual(["packages/ui/src/drafts.ts:1 @acme/notes/drafts/Draft.ts"]));
	},
);

for (const placeholder of [".gitkeep", ".keep", "README.md"]) {
	const kept = `src/generated/${placeholder}`;
	const keptFolder = [
		UNRESOLVABLE,
		repositoryHas({ content: `src/generated/*\n!${kept}\n`, path: ".gitignore" }, { content: "Written by `pnpm generate`.\n", path: kept }),
	];

	importStory.it(
		`imports/resolvable takes a generated folder that git keeps with a tracked ${placeholder} while ignoring its contents`,
		[...keptFolder, gitTracks(kept)],
		function* ({ check, subjects }) {
			yield* check(importsResolvable, { generated: ["src/generated"] });

			yield* assertThat(yield* subjects(), (actual) => actual.toEqual(OTHER_UNRESOLVED));
		},
	);

	importStory.it(
		`imports/resolvable refuses a generated folder that holds another tracked file beside its ${placeholder}`,
		[...keptFolder, repositoryHas({ content: "export const kept = 1;\n", path: "src/generated/kept.ts" }), gitTracks(kept, "src/generated/kept.ts")],
		function* ({ refusal }) {
			yield* assertThat(yield* refusal(importsResolvable, { generated: ["src/generated"] }), (actual) =>
				actual.toContain('"src/generated" holds files git tracks, such as src/generated/kept.ts, so it is not generated output'),
			);
		},
	);
}

importStory.it(
	"imports/resolvable refuses generated folders under node_modules, outside git's ignores and named by no import, naming each problem",
	[UNRESOLVABLE],
	function* ({ refusal }) {
		yield* assertThat(yield* refusal(importsResolvable, { generated: ["src/node_modules/ghost", "src", "src/generated/unused"] }), (actual) =>
			actual.toBe(
				[
					"the generated folders are invalid:",
					'  - "src/node_modules/ghost" lies in node_modules, which holds installed packages, not generated output',
					'  - "src" is not ignored by git, so it holds source, not generated output',
					'  - "src/generated/unused" holds no file that an import names',
				].join("\n"),
			),
		);
	},
);

for (const [folder, normalized] of [
	["./", ""],
	["../generated", "../generated"],
	["/generated", "/generated"],
] as const) {
	importStory.it(`imports/resolvable refuses the generated folder "${folder}" outside the repository`, [UNRESOLVABLE], function* ({ refusal }) {
		yield* assertThat(yield* refusal(importsResolvable, { generated: [folder] }), (actual) =>
			actual.toContain(`"${normalized}" is no folder inside the repository`),
		);
	});
}
