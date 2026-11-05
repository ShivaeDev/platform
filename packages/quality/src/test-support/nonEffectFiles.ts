import type { SeedFile } from "#testing/adapters/tree.ts";

const SOURCE = [
	'import { readFileSync } from "node:fs";',
	'import { Context, Effect, Layer, Schema } from "effect";',
	'export class Store extends Context.Service<Store, { read: () => Effect.Effect<string> }>()("Store") {}',
	'export async function work(store: Store) { return readFileSync("file", "utf8") + String(store); }',
	'export const recovered = Effect.fail("failure").pipe(Effect.catch(() => Effect.succeed("hidden")));',
	'export const span = Effect.fn("invalid")(() => Effect.void);',
	"export function computation() { return Effect.gen(function* () { return yield* Effect.succeed(1); }); }",
	"export const storeLayer = Layer.empty;",
	'export const shape = Schema.Struct({ "created_at": Schema.String });',
	"export const time = Date.now();",
	"// TODO: choose a name.",
].join("\n");

export const nonEffectFiles: readonly SeedFile[] = [
	{ content: "node_modules/\n", path: ".gitignore" },
	{ content: '{ "extends": ["@shivaedev/quality/biome/preset.json"] }', path: "biome.json" },
	{ content: '{"workspaces":["packages/*"]}', path: "package.json" },
	{ content: '{"name":"@demo/game","type":"module","dependencies":{"effect":"*"}}', path: "packages/game/package.json" },
	...[
		"packages/game/src/simulation/code.ts",
		"packages/game/src/simulation/nested/code.ts",
		"packages/game/src/engine/code.ts",
		"packages/game/src/simulationExtra/code.ts",
		"packages/game/src/ordinary/code.ts",
	].map((path) => ({ content: SOURCE, path })),
	{
		content: 'import { work, Store } from "./simulation/code.ts"; export async function importer(store: Store) { return work(store); }',
		path: "packages/game/src/importer.ts",
	},
	...["simulation", "ordinary"].map((folder) => ({
		content: 'import { Effect } from "effect"; import { test } from "vitest"; test("runs", () => Effect.gen(function* () { yield* Effect.void; }));',
		path: `packages/game/src/${folder}/sample.spec.ts`,
	})),
];

export function nonEffectConfig(folders: readonly string[] = ["packages/game/src/simulation", "packages/game/src/engine"]): SeedFile {
	return {
		content: `export default ${JSON.stringify({ nonEffectFolders: folders, sources: ["packages/game/src"] })};`,
		path: "quality.config.ts",
	};
}
