import { Effect, Layer, Schema } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { collection } from "@shivaedev/changes/keys.ts";
import { bind } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";

export type Person = "alice" | "bob";

export interface Backend {
	readonly reads: Person[];
	readonly titles: Map<Person, string>;
}

const preferences = collection("preferences", Schema.Number);
const Preferences = contract("preferences", {
	commands: [command("save", { invalidates: () => [preferences.item(0)], payload: { title: Schema.String }, success: Schema.Void })],
	keyScope: "session",
	queries: [query("self", { readPolicy: () => Effect.succeed(true), reads: () => [preferences.item(0)], success: Schema.String })],
});

export function bindPreferences(person: Person, backend: Backend, runtime: Atom.RuntimeFactory, registry: AtomRegistry.AtomRegistry) {
	const application = Preferences.application.toLayer({
		"preferences.save": ({ title }) =>
			Effect.sync(() => {
				backend.titles.set(person, title);
			}),
		"preferences.self": () =>
			Effect.sync(() => {
				backend.reads.push(person);
				return backend.titles.get(person) ?? "";
			}),
	});
	class Client extends AtomRpc.Service<Client>()(`test/SessionKeys/${person}`, {
		group: Preferences,
		makeEffect: RpcTest.makeClient(Preferences, { flatten: true }),
		protocol: Layer.merge(application, hostChanges(Preferences).pipe(Layer.provide(application))),
		runtime,
	}) {}
	return { api: bind(Preferences, Client, { live: false, registry }), runtime: Client.runtime };
}
