import { expect } from "@effect/vitest";
import { importsResolvable } from "#rules/imports/resolvable.ts";
import { importStory, repositoryHas } from "#test/importStory.ts";
import { viteAssets } from "#test/viteAssets.ts";

for (const suffix of [
	"url",
	"raw",
	"worker",
	"worker&inline",
	"worker&url",
	"sharedworker",
	"sharedworker&inline",
	"sharedworker&url",
	"inline",
	"no-inline",
	"url&inline",
	"url&no-inline",
	"init",
]) {
	importStory.it(
		`imports/resolvable accepts an exported package asset with ?${suffix}`,
		[repositoryHas(...viteAssets, { content: `import asset from "@demo/assets/reader/reader.wasm?${suffix}";`, path: "src/main.ts" })],
		function* ({ check, subjects }) {
			yield* check(importsResolvable);

			expect(yield* subjects()).toEqual([]);
		},
	);
}

importStory.it(
	"imports/resolvable accepts an exported worker script with a Vite suffix in NodeNext",
	[
		repositoryHas(
			...viteAssets,
			{ content: '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext"},"include":["src"]}', path: "tsconfig.json" },
			{ content: 'import Worker from "@demo/assets/worker.js?worker";', path: "src/main.mts" },
		),
	],
	function* ({ check, subjects }) {
		yield* check(importsResolvable);

		expect(yield* subjects()).toEqual([]);
	},
);

importStory.it(
	"imports/resolvable reports a missing exported package asset with a Vite suffix",
	[repositoryHas(...viteAssets, { content: 'import asset from "@demo/assets/reader/missing.wasm?url";', path: "src/main.ts" })],
	function* ({ check, subjects }) {
		yield* check(importsResolvable);

		expect(yield* subjects()).toEqual(["@demo/assets/reader/missing.wasm?url"]);
	},
);

importStory.it(
	"imports/resolvable reports a package asset that is not exported even with a Vite suffix",
	[repositoryHas(...viteAssets, { content: 'import asset from "@demo/assets/dist/private.wasm?url";', path: "src/main.ts" })],
	function* ({ check, subjects }) {
		yield* check(importsResolvable);

		expect(yield* subjects()).toEqual(["@demo/assets/dist/private.wasm?url"]);
	},
);

for (const specifier of ["@demo/assets/worker.js?unsupported", "@demo/assets/reader/reader.wasm?unsupported", "@demo/assets/worker.js?init"]) {
	importStory.it(
		`imports/resolvable reports the suffix vite/client does not type in ${specifier}`,
		[repositoryHas(...viteAssets, { content: `import asset from "${specifier}";`, path: "src/main.ts" })],
		function* ({ check, subjects }) {
			yield* check(importsResolvable);

			expect(yield* subjects()).toEqual([specifier]);
		},
	);
}

importStory.it(
	"imports/resolvable accepts a relative asset with a Vite suffix",
	[repositoryHas(...viteAssets, { content: 'import asset from "./reader.wasm?url";', path: "src/main.ts" })],
	function* ({ check, subjects }) {
		yield* check(importsResolvable);

		expect(yield* subjects()).toEqual([]);
	},
);
