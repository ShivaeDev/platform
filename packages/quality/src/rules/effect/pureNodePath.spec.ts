import { adapterImports } from "#rules/effect/adapterImports.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const MANIFEST = { content: '{"name":"@demo/kit","dependencies":{"effect":"*"}}', path: "package.json" };

ruleStory.it(
	"effect/adapter-imports accepts node:path and its posix and win32 forms in shipped helpers and Effect.fn bodies",
	[
		repositoryHas(
			MANIFEST,
			{
				content:
					'import { posix } from "node:path";\nconst TOOL_FOLDERS = new Set(["script", "scripts", "tooling"]);\nexport function isTooling(directory: string, path: string): boolean {\n\tconst [folder = ""] = posix.relative(directory, path).split("/");\n\treturn TOOL_FOLDERS.has(folder);\n}\n',
				path: "src/imports/isTooling.ts",
			},
			{
				content:
					'import { join } from "node:path";\nimport { Effect, FileSystem } from "effect";\nexport const runtimeFoldersOf = Effect.fn("Imports.runtimeFoldersOf")(function* (root: string, directory: string) {\n\tconst fs = yield* FileSystem.FileSystem;\n\treturn yield* Effect.filter(["client", "server"], (folder) => Effect.map(fs.stat(join(root, directory, "src", folder)), (info) => info.type === "Directory"));\n});\n',
				path: "src/imports/runtime.ts",
			},
			{
				content:
					'import { relative } from "node:path/posix";\nimport { win32 } from "node:path";\nimport { sep } from "path/win32";\nexport const separators = [relative("a", "b"), win32.sep, sep];\n',
				path: "src/imports/separators.ts",
			},
		),
	],
	function* ({ check }) {
		yield* assertThat(yield* check(adapterImports), (actual) => actual.toEqual([]));
	},
);

ruleStory.it(
	"effect/adapter-imports still reports node:fs beside an accepted node:path import",
	[
		repositoryHas(MANIFEST, {
			content:
				'import { readFileSync } from "node:fs";\nimport { dirname, join } from "node:path";\nexport const source = (path: string) => readFileSync(join(dirname(path), "names.ts"), "utf8");\n',
			path: "src/imports/browserNames.ts",
		}),
	],
	function* ({ check, locations }) {
		yield* check(adapterImports);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["src/imports/browserNames.ts:1"]));
	},
);

const OTHER_BUILTINS = [
	"node:fs",
	"node:fs/promises",
	"node:child_process",
	"node:os",
	"node:url",
	"node:crypto",
	"node:module",
	"node:util",
	"node:buffer",
	"node:process",
];

ruleStory.it(
	"effect/adapter-imports still reports every other Node builtin, including node:process outside an entry module",
	[
		repositoryHas(MANIFEST, {
			content: OTHER_BUILTINS.map((name, index) => `import * as builtin${String(index)} from "${name}";`).join("\n"),
			path: "src/work.ts",
		}),
	],
	function* ({ check, locations }) {
		yield* check(adapterImports);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(OTHER_BUILTINS.map((_, index) => `src/work.ts:${String(index + 1)}`)));
	},
);
