import { Effect, Schema } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { collection } from "@shivaedev/changes/keys.ts";
import { type ClientActivity, clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { layerLiveMemoryProtocol } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";

export type Person = "alice" | "bob";

export interface Backend {
	readonly reads: Person[];
	readonly titles: Map<Person, string>;
}

export type Activities = Map<Person, ClientActivity>;

const preferences = collection("preferences", Schema.Number);
const Preferences = contract("preferences", {
	commands: [command("save", { invalidates: () => [preferences.item(0)], payload: { title: Schema.String }, success: Schema.Void })],
	keyScope: "session",
	queries: [query("self", { readPolicy: () => Effect.succeed(true), reads: () => [preferences.item(0)], success: Schema.String })],
});

export function bindPreferences(
	person: Person,
	backend: Backend,
	activities: Activities,
	runtime: Atom.RuntimeFactory,
	registry: AtomRegistry.AtomRegistry,
) {
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
	const connection = makeClient(
		{ preferences: Preferences },
		{
			protocol: layerLiveMemoryProtocol(Preferences, application),
			registry,
			runtime,
			url: `memory://preferences/${person}`,
		},
	);
	activities.set(person, clientActivity(connection));
	return { api: connection.api.preferences };
}
