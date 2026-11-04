import type { SeedFile } from "#testing/adapters/tree.ts";

export const engineBodyFiles: readonly SeedFile[] = [
	{
		content:
			'import { Context, Schema } from "effect"; import { defineService } from "@shivaedev/service/defineService.ts"; export const Tasks = defineService({}); export class Draft extends Schema.Class<Draft>("Draft")({}) {} export class Orders extends Context.Service<Orders, { save(): unknown }>()("Orders") {} export function makeOrders() { return {}; } export class Client {}',
		path: "src/runtime.ts",
	},
	{ content: 'export { Orders as Store, makeOrders as createStore } from "./runtime.ts";', path: "src/exported.ts" },
];

export function engineBody(code: string, parameters = "{ save, story }", traits = "[configured]", path = "src/orders.spec.ts"): SeedFile {
	return {
		content: [
			'import { app as orders } from "#test/index.ts";',
			'import { Effect, Ref, Schema } from "effect";',
			'import * as SqlClient from "effect/sql/SqlClient";',
			'import { Orders, Tasks, Draft, makeOrders, Client } from "./runtime.ts";',
			'import { Store, createStore } from "./exported.ts"; import * as runtime from "./runtime.ts";',
			`orders.it("saves an order", ${traits}, function* (${parameters}) {`,
			`\t${code}`,
			"});",
		].join("\n"),
		path,
	};
}
