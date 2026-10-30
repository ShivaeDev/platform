import { Effect, Layer, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcTest } from "effect/rpc";
import { invalidationKeys, type Key } from "@shivaedev/changes/keys.ts";
import { LiveConnection } from "#automaticLive.ts";
import { bind } from "#bind.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { type QueryReference, queryKeys } from "#serverMetadata.ts";
import { Guard, Preferences, Save, Session } from "#test/sessionContract.ts";

export const sessionEngine = Effect.gen(function* () {
	const stored = new Map([
		["alice", "Alice"],
		["bob", "Bob"],
	]);
	const reads: string[] = [];
	const subscriptions = new Map<string, Set<readonly QueryReference[]>>();
	const reactivity = yield* Reactivity.make;
	const server = yield* makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const runtime = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() });
	function read(label: string) {
		return Effect.map(Session, (session) => {
			reads.push(`${session}:${label}`);
			return stored.get(session) ?? "";
		});
	}
	function trackSubscription(session: string, queries: readonly QueryReference[]) {
		const current = subscriptions.get(session) ?? new Set();
		current.add(queries);
		subscriptions.set(session, current);
		return () => {
			current.delete(queries);
			if (current.size === 0) {
				subscriptions.delete(session);
			}
		};
	}
	const handlers = Preferences.toLayer({
		"preferences.$changes": ({ queries }) =>
			Stream.unwrap(
				Effect.gen(function* () {
					const session = yield* Session;
					const keys = yield* queryKeys(Preferences.declaration.queries, queries);
					const stop = trackSubscription(session, queries);
					return server.stream(keys, { scope: session }).pipe(Stream.ensuring(Effect.sync(stop)));
				}),
			),
		"preferences.get": ({ id }) => read(`get:${id}`),
		"preferences.list": () => Effect.map(read("list"), (title) => [title]),
		"preferences.save": ({ title }) =>
			title === ""
				? Save.reject.Rejected({})
				: Effect.flatMap(Session, (session) =>
						Effect.sync(() => {
							stored.set(session, title);
						}),
					),
		"preferences.self": () => read("self"),
	});
	function open(session: string) {
		return Effect.gen(function* () {
			const registry = yield* Effect.acquireRelease(
				Effect.sync(() => AtomRegistry.make()),
				(current) => Effect.sync(() => current.dispose()),
			);
			class Client extends AtomRpc.Service<Client>()(`test/Private/${session}`, {
				group: Preferences,
				makeEffect: RpcTest.makeClient(Preferences, { flatten: true }),
				protocol: Layer.merge(
					handlers,
					Layer.succeed(Guard, (effect) => Effect.provideService(effect, Session, session)),
				),
				runtime,
			}) {}
			const api = bind(Preferences, Client, { registry });
			const otherBinding = bind(Preferences, Client, { registry });
			function run<A, E>(effect: Effect.Effect<A, E, Client | Reactivity.Reactivity>) {
				return Effect.suspend(() => AtomRegistry.getResult(registry, Client.runtime.atom(effect)));
			}
			return {
				api,
				pause: (paused: boolean) => registry.set(otherBinding[LiveConnection].paused, paused),
				registry,
				run,
				withoutOwner: () => Reflect.apply(bind, undefined, [Preferences, Client]),
			};
		});
	}
	const alice = yield* open("alice");
	const bob = yield* open("bob");
	const clients = { alice, bob };
	function watch(session: keyof typeof clients, query: "self" | "list" | number) {
		const { api, registry } = clients[session];
		let atom: Atom.Atom<AsyncResult.AsyncResult<string | readonly string[], unknown>>;
		if (typeof query === "number") {
			atom = api.get.query({ id: query });
		} else {
			atom = query === "self" ? api.self.query(undefined) : api.list.query(undefined);
		}
		const release = registry.mount(atom);
		return { release, value: () => AsyncResult.getOrElse(registry.get(atom), () => undefined), waiting: () => registry.get(atom).waiting };
	}
	return {
		announce: (session: string, keys: readonly Key[]) => reactivity.invalidate(invalidationKeys(keys, { scope: session })),
		clients,
		connect: (session: keyof typeof clients) => {
			const { api, registry } = clients[session];
			registry.set(api[LiveConnection].coalesceWindow, 0);
			return registry.mount(api[LiveConnection].connection);
		},
		reads,
		server,
		stored,
		subscriptions,
		watch,
	};
});
