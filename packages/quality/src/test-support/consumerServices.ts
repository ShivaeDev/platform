import { symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { linkWorkspace } from "#testing/adapters/imports.ts";
import type { SeedFile } from "#testing/adapters/tree.ts";
import { repositoryStory } from "./repositoryStory.ts";

export function effectInstalled() {
	return repositoryStory.trait("repository", "Effect is installed in the consuming repository", (engine) => {
		symlinkSync(dirname(createRequire(import.meta.url).resolve("effect/package.json")), join(engine.root, "node_modules/effect"), "dir");
	});
}

export const consumerWorkspace = [
	{ content: '{"private":true}', path: "package.json" },
	{ content: "packages:\n  - packages/*\n  - packages/group/*\n", path: "pnpm-workspace.yaml" },
	{ content: '{"name":"@antumbra/group"}', path: "packages/group/package.json" },
	{
		content:
			'{"name":"@antumbra/domain","exports":{"./*.ts":{"source":"./src/*.ts","types":"./dist/*.d.ts","default":"./dist/*.js"}},"dependencies":{"effect":"*"}}',
		path: "packages/group/domain/package.json",
	},
];

export const consumerService = {
	content: [
		'import { Context } from "effect";',
		'export class Store extends Context.Service<Store, { readonly value: string }>()("@antumbra/domain/Store") {}',
	].join("\n"),
	path: "packages/group/domain/src/Store.ts",
};

export function workspaceStoreInstalled() {
	return repositoryStory.trait("repository", "the workspace store resolves by its manifest name", (engine) => {
		linkWorkspace(engine.root, "@antumbra/domain", "packages/group/domain");
	});
}

export function workspaceGroupInstalled() {
	return repositoryStory.trait("repository", "the parent workspace package resolves by its manifest name", (engine) => {
		linkWorkspace(engine.root, "@antumbra/group", "packages/group");
	});
}

export const independentConsumer = [
	{
		content:
			'{"name":"@antumbra/group","exports":{"./*.ts":{"source":"./src/*.ts","types":"./dist/*.d.ts","default":"./dist/*.js"}},"dependencies":{"effect":"*"}}',
		path: "packages/group/package.json",
	},
	{
		content:
			'{"name":"@antumbra/plain","exports":{"./*.ts":{"source":"./src/*.ts","types":"./dist/*.d.ts","default":"./dist/*.js"}},"dependencies":{"@antumbra/group":"*"}}',
		path: "packages/group/plain/package.json",
	},
	{
		content: 'import type { Effect } from "effect"; export interface Options { readonly read: () => Effect.Effect<string> }',
		path: "packages/group/src/Options.ts",
	},
	{
		content: 'import type { Options } from "@antumbra/group/Options.ts"; export function run(options: Options) { return options.read(); }',
		path: "packages/group/plain/src/run.ts",
	},
	{
		content: [
			'import type { Options } from "@antumbra/group/Options.ts";',
			'import { Context } from "effect";',
			'export class Store extends Context.Service<Store, Options>()("@antumbra/domain/Store") {}',
		].join("\n"),
		path: consumerService.path,
	},
	{
		content:
			'{"name":"@antumbra/domain","exports":{"./*.ts":{"source":"./src/*.ts","types":"./dist/*.d.ts","default":"./dist/*.js"}},"dependencies":{"@antumbra/group":"*","effect":"*"}}',
		path: "packages/group/domain/package.json",
	},
];

export function serviceConsumer(installed: boolean): readonly SeedFile[] {
	const directory = installed ? "node_modules/@antumbra/domain" : "packages/group/domain";
	return [
		{
			content:
				'{"name":"@antumbra/app","exports":{"./*.ts":{"source":"./src/*.ts","types":"./dist/*.d.ts","default":"./dist/*.js"}},"dependencies":{"@antumbra/domain":"*","effect":"*"}}',
			path: "packages/app/package.json",
		},
		{
			content: [
				'import { Context, Effect } from "effect";',
				"export interface StoreShape { readonly read: () => Effect.Effect<string> }",
				installed
					? 'export declare const Store: Context.Service<"@antumbra/domain/Store", StoreShape>;'
					: 'export class Store extends Context.Service<Store, StoreShape>()("@antumbra/domain/Store") {}',
			].join("\n"),
			path: `${directory}/${installed ? "dist/Store.d.ts" : "src/Store.ts"}`,
		},
		{
			content: 'import type { StoreShape } from "@antumbra/domain/Store.ts";\nexport function read(store: StoreShape) { return store.read(); }',
			path: "packages/app/src/read.ts",
		},
		...(installed
			? [
					{
						content: '{"name":"@antumbra/domain","exports":{"./*.ts":{"types":"./dist/*.d.ts","default":"./dist/*.js"}}}',
						path: `${directory}/package.json`,
					},
				]
			: []),
	];
}
