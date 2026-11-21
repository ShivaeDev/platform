import { Effect, Layer, Stream, SubscriptionRef } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { rerunQuery } from "@shivaedev/server/rerunQuery.ts";
import { layerMemoryProtocol } from "@shivaedev/test-kits/contract/testing.ts";
import { changesHandlerLayer } from "#changesHandlerLayer.ts";
import { type ContractsClient, makeClient } from "#makeClient.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { querySubscription } from "#querySubscription.ts";
import { CurrentViewer } from "#readPolicy.ts";
import type { QueryReference } from "#serverMetadata.ts";
import type { Mark } from "#test/reRead.ts";
import { Guard, Preferences, preferences, Save, Session } from "#test/sessionContract.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

export type Person = "alice" | "bob";
export type PreferenceView = "preferences" | "list" | "preference 1";

interface OpenSubscription {
	readonly person: string;
	readonly queries: readonly QueryReference[];
}

export const sessionEngine = Effect.gen(function* () {
	const stored = new Map<string, string>([
		["alice", "Alice"],
		["bob", "Bob"],
	]);
	const reads = yield* SubscriptionRef.make<readonly string[]>([]);
	const subscriptions = yield* SubscriptionRef.make<readonly OpenSubscription[]>([]);
	const reactivity = yield* Reactivity.make;
	const server = yield* makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const runtime = yield* storyRuntime;
	function read(label: string) {
		return Effect.flatMap(Session, (person) =>
			Effect.as(
				SubscriptionRef.update(reads, (all) => [...all, `${person}:${label}`]),
				stored.get(person) ?? "",
			),
		);
	}
	const application = Preferences.application.toLayer({
		"preferences.get": ({ id }) => read(`get:${id}`),
		"preferences.list": () => Effect.map(read("list"), (title) => [title]),
		"preferences.save": ({ title }) =>
			title === ""
				? Save.reject.Rejected({})
				: Effect.flatMap(Session, (person) =>
						Effect.sync(() => {
							stored.set(person, title);
						}).pipe(Effect.andThen(reactivity.invalidate(invalidationKeys([preferences.item(0)])))),
					),
		"preferences.self": () => read("self"),
	});
	const changes = changesHandlerLayer(
		Preferences,
		() =>
			({ queries }, options) =>
				Stream.unwrap(
					Effect.gen(function* () {
						const person = yield* Session;
						const requested = yield* querySubscription(options.rpc, queries, yield* CurrentViewer);
						const subscription: OpenSubscription = { person, queries };
						yield* SubscriptionRef.update(subscriptions, (all) => [...all, subscription]);
						return server
							.subscribe(requested, rerunQuery(Preferences.application, options))
							.pipe(Stream.ensuring(SubscriptionRef.update(subscriptions, (all) => all.filter((current) => current !== subscription))));
					}),
				),
	);
	const handlers = Layer.merge(application, changes.pipe(Layer.provide(application)));
	function open(person: Person) {
		return Effect.gen(function* () {
			const registry = yield* Effect.acquireRelease(
				Effect.sync(() => AtomRegistry.make()),
				(current) => Effect.sync(() => current.dispose()),
			);
			const protocol = layerMemoryProtocol(Preferences).pipe(
				Layer.provide(
					Layer.merge(
						handlers,
						Layer.succeed(Guard, (effect) => Effect.provideService(effect, Session, person)),
					),
				),
			);
			const connection = makeClient({ otherBinding: Preferences, preferences: Preferences }, { protocol, registry, runtime });
			const api = connection.api.preferences;
			function run<A, E>(effect: Effect.Effect<A, E, ContractsClient | Reactivity.Reactivity>) {
				return Effect.suspend(() => AtomRegistry.getResult(registry, connection.runtime.atom(Effect.suspend(() => effect))));
			}
			function view(name: PreferenceView): Atom.Atom<AsyncResult.AsyncResult<string | readonly string[], unknown>> {
				switch (name) {
					case "preferences":
						return api.self.query(undefined);
					case "list":
						return api.list.query(undefined);
					case "preference 1":
						return api.get.query({ id: 1 });
				}
			}
			return {
				api,
				otherBinding: connection.api.otherBinding,
				registry,
				run,
				view,
				withoutOwner: () => Reflect.apply(makeClient, undefined, [{ preferences: Preferences }, { protocol, runtime }]),
			};
		});
	}
	const clients = { alice: yield* open("alice"), bob: yield* open("bob") };
	const kept: { effect?: Effect.Effect<void, unknown> } = {};
	return {
		announce: () => reactivity.invalidate(invalidationKeys([preferences.item(0)])),
		clients,
		kept,
		marked: new Map<string, Mark>(),
		mounted: new Map<string, { readonly person: Person; readonly release: () => void; readonly view: PreferenceView }>(),
		reads,
		server,
		stored,
		subscriptions,
	};
});

export type SessionEngine = Effect.Success<typeof sessionEngine>;
