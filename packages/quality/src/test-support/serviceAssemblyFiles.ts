import { symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { SeedFile } from "#testing/adapters/tree.ts";
import { repositoryStory } from "./repositoryStory.ts";

export function serviceInstalled() {
	return repositoryStory.trait("repository", "the real service package resolves in the consumer", (engine) => {
		symlinkSync(
			dirname(createRequire(import.meta.url).resolve("@shivaedev/service/package.json")),
			join(engine.root, "node_modules/@shivaedev/service"),
			"dir",
		);
	});
}

export function serviceAssembly(definition: string, preamble = "", imports = ""): SeedFile {
	return {
		content: [
			...(definition.includes("Effect.") || preamble.includes("Effect.") ? ['import { Effect } from "effect";'] : []),
			'import { defineService } from "@shivaedev/service/defineService.ts";',
			'import { genericMethod } from "@shivaedev/service/genericMethod.ts";',
			'import { initialize } from "#initialize.ts";',
			'import { preserve } from "#preserve.ts";',
			'import { read } from "#read.ts";',
			'import { remember } from "#remember.ts";',
			'import { reset } from "#reset.ts";',
			imports,
			preamble,
			`export const Inventory = defineService(${definition});`,
		].join("\n"),
		path: "src/Inventory.ts",
	};
}

export const ASSEMBLY_INVENTORY =
	'{ id: "@demo/inventory/Inventory", initialize, methods: (state) => ({ preserve: genericMethod(preserve), read: read(state), remember: genericMethod(remember(state)), reset }), requires: [] }';

export const assemblyFiles: readonly SeedFile[] = [
	{
		content:
			'{"name":"@demo/inventory","type":"module","imports":{"#*.ts":{"source":"./src/*.ts","types":"./dist/*.d.ts","default":"./dist/*.js"}},"exports":{"./*.ts":{"source":"./src/*.ts","types":"./dist/*.d.ts","default":"./dist/*.js"}},"dependencies":{"@shivaedev/service":"*","effect":"*"}}',
		path: "package.json",
	},
	{ content: 'import { Ref } from "effect"; export const initialize = Ref.make(0);', path: "src/initialize.ts" },
	{
		content:
			'import { Effect, Ref } from "effect"; export function read(state: Ref.Ref<number>) { return Effect.fn("Inventory.read")(() => Ref.get(state)); }',
		path: "src/read.ts",
	},
	{ content: 'import { Effect } from "effect"; export const reset = Effect.fn("Inventory.reset")(() => Effect.void);', path: "src/reset.ts" },
	{
		content:
			'import { Effect } from "effect"; export const preserve = Effect.fn("Inventory.preserve")(<A, E, R>(value: Effect.Effect<A, E, R>) => value);',
		path: "src/preserve.ts",
	},
	{
		content:
			'import { Effect, Ref } from "effect"; export function remember(state: Ref.Ref<number>) { return Effect.fn("Inventory.remember")(<A, E, R>(value: Effect.Effect<A, E, R>) => value.pipe(Effect.tap(() => Ref.update(state, (count) => count + 1)))); }',
		path: "src/remember.ts",
	},
];

export const statelessAssembly: SeedFile = {
	content: [
		'import { Effect } from "effect";',
		'import { defineService as assemble } from "@shivaedev/service/defineService.ts";',
		'import { reset } from "#reset.ts";',
		'export const Inventory = assemble({ id: "@demo/inventory/Inventory", initialize: Effect.void, methods: () => ({ reset }), requires: [] });',
	].join("\n"),
	path: "src/Inventory.ts",
};
