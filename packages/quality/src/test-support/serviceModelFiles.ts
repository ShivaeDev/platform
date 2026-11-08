import { createRequire } from "node:module";
import { dirname } from "node:path";
import { repositoryLinks } from "#test/ruleStory.ts";

export function serviceResolves() {
	return repositoryLinks("node_modules/@shivaedev/service", dirname(createRequire(import.meta.url).resolve("@shivaedev/service/package.json")));
}

export function modelFiles(initialize = "Effect.void", operation = 'Effect.fn("Inventory.read")(() => Effect.void)', inventory = "read") {
	return [
		{
			content: `import { defineService } from "@shivaedev/service/defineService.ts";
import { initialize, Store, Settings, OptionalSettings, Prefix, Subject } from "./initialize.ts";
import * as SqlClient from "effect/sql/SqlClient";
import * as HttpClient from "effect/http/HttpClient";
import { read } from "./read.ts";
export const Inventory = defineService({ id: "app/Inventory", initialize, requires: [Store, Settings, OptionalSettings, Prefix, Subject, SqlClient.SqlClient, HttpClient.HttpClient], methods: (state) => ({ read: ${inventory} }) });`,
			path: "src/inventory/service.ts",
		},
		{
			content: `import { Context, Effect, Ref, Scope, Semaphore } from "effect";
import * as SqlClient from "effect/sql/SqlClient";
import * as HttpClient from "effect/http/HttpClient";
interface StoreShape { readonly read: () => Effect.Effect<string> }
export class Store extends Context.Service<Store, StoreShape>()("app/Store") {}
export class Settings extends Context.Service<Settings, { readonly endpoint: string }>()("app/Settings") {}
export class OptionalSettings extends Context.Service<OptionalSettings, { readonly endpoint?: string }>()("app/OptionalSettings") {}
export class Prefix extends Context.Service<Prefix, string>()("app/Prefix") {}
export class Subject extends Context.Service<Subject, { readonly id: string }>()("app/Subject") {}
const load = Effect.fn("Inventory.load")(function* () { return yield* (yield* Store).read(); });
export const initialize = ${initialize};`,
			path: "src/inventory/initialize.ts",
		},
		{
			content: `import { Effect } from "effect"; export const read = ${operation};`,
			path: "src/inventory/read.ts",
		},
	];
}

export const builtClient = {
	content: `import { Effect } from "effect";
import * as SqlClient from "effect/sql/SqlClient";
export const buildClient = Effect.gen(function* () {
 const sql = yield* SqlClient.SqlClient;
 return { read: () => sql\`select 1\` };
});`,
	path: "src/inventory/buildClient.ts",
};
