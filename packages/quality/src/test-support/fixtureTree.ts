import { Schema } from "effect";
import rawTrees from "#test/fixtures/import-trees.json" with { type: "json" };
import type { SeedFile } from "./tree.ts";

export interface Fixture {
	readonly files: readonly SeedFile[];
	readonly story: string;
}

const STORIES = {
	aliases:
		"a core package that imports better-auth, @trpc/server, hast and @demo/kit through a package.json alias, a tsconfig path, a relative path and types-only packages",
	cycle: "src/a.ts, src/b.ts and src/c.ts, which import each other at runtime, and src/lazy.ts, which imports itself lazily",
	empty: "only Markdown files",
	fence:
		"a game package whose play, run and words modules import the cms, simulation and vocabulary packages, beside game tests that make the same imports",
	generatedAlias: "a test that imports git-ignored generated and cached clients through the #test/* alias",
	nested: "a game module that imports a cms test fixture with its own package.json",
	pending: "a game module that imports a cms client its generator has not written yet",
	references: "type and path references, JSDoc @import tags, require.resolve and import.meta.resolve calls, each with one missing target",
	resolution:
		"src/main.ts, which imports through a tsconfig path, a package.json import, the @demo/shared workspace package, a JSON file and require",
	typeCycle: "modules that import each other only through import type, export type and a type query",
	unresolvable: "src/main.ts, which imports missing files and packages beside builtins, assets, declared modules and declaration files",
} as const;

export type TreeName = keyof typeof STORIES;

const trees = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Array(Schema.Struct({ content: Schema.String, path: Schema.String }))))(
	rawTrees,
);

export function fixtureTree(name: TreeName): Fixture {
	const files = trees[name];
	if (files === undefined) {
		throw new Error(`fixtures/import-trees.json holds no tree named ${name}`);
	}
	return { files, story: STORIES[name] };
}
