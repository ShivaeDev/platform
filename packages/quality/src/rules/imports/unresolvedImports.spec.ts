import { expect } from "vitest";
import { importsResolvable } from "#rules/imports/resolvable.ts";
import { fixtureTree } from "#test/fixtureTree.ts";
import { importStory, repositoryHolds } from "#test/importStory.ts";

importStory.it(
	"imports/resolvable reports every import it cannot resolve, and resolves builtins, assets, declared modules and type imports of declaration files",
	[repositoryHolds(fixtureTree("unresolvable"))],
	function* ({ check, sites }) {
		yield* check(importsResolvable);

		expect(yield* sites()).toEqual([
			"src/main.ts:1 ./gone.ts",
			"src/main.ts:2 left-pad",
			"src/main.ts:6 ./generated/client.ts",
			"src/main.ts:9 ../dist/does-not-exist.ts",
			"src/main.ts:10 ./node_modules/ghost/index.ts",
			"src/main.ts:11 ./missing.css",
			"src/main.ts:12 other:thing",
			"src/main.ts:13 augmented",
			"src/main.ts:14 ./ghost.ts",
			"src/main.ts:16 hast",
			"src/main.ts:18 dts-only",
			"src/main.ts:20 ./ghost.css",
		]);
	},
);

importStory.it(
	"imports/resolvable tells the author to fix the path, install or declare the package, or declare the module",
	[repositoryHolds(fixtureTree("unresolvable"))],
	function* ({ check, messages }) {
		yield* check(importsResolvable);

		expect(yield* messages()).toContain(
			'Cannot resolve "./gone.ts". Fix the path, install or declare the package, or declare the module in a .d.ts file among the sources.',
		);
	},
);

importStory.it(
	"imports/resolvable checks type and path references, JSDoc @import tags, require.resolve and import.meta.resolve",
	[repositoryHolds(fixtureTree("references"))],
	function* ({ check, sites }) {
		yield* check(importsResolvable);

		expect(yield* sites()).toEqual([
			"src/env.d.ts:2 absent",
			"src/env.d.ts:4 ./absent.d.ts",
			"src/tool.js:2 ./gone-type.ts",
			"src/where.ts:2 ./nowhere.cjs",
			"src/where.ts:5 absent-package",
		]);
	},
);
