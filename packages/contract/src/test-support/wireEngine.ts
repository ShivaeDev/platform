import { layerWebSocketConstructor } from "@effect/platform-node/NodeSocket";
import { Clock, Context, Effect, Layer, Option, Ref } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { appHost } from "@shivaedev/server/appHost.ts";
import { liveServerLayer } from "#live-server/layer.ts";
import { makeClient } from "#makeClient.ts";
import { moduleHandlers } from "#moduleHandlers.ts";
import { CurrentViewer } from "#readPolicy.ts";
import { storyRuntime } from "#test/storyRuntime.ts";
import { type StoredNote, WireNotes, WireNotesStore } from "#test/wireNotes.ts";
import { WireNotes as WireNotesClient } from "#test/wireNotesClient.ts";
import { WireCaller } from "#test/wireNotesModel.ts";

const VIEWER = "alice";

export const wireEngine = Effect.gen(function* () {
	const clock = yield* Clock.Clock;
	const stored = yield* Ref.make<readonly StoredNote[]>([]);
	const store = WireNotesStore.of({
		insert: (title, owner) =>
			Ref.modify(stored, (notes) => {
				const note = { createdAt: new Date(clock.currentTimeMillisUnsafe()), id: notes.length + 1, owner, title };
				return [note, [...notes, note]];
			}),
		owned: (owner) => Effect.map(Ref.get(stored), (notes) => notes.filter((note) => note.owner === owner)),
	});
	const caller = Layer.succeed(WireCaller, (effect, request) =>
		Effect.provideService(
			effect,
			CurrentViewer,
			Option.map(Option.fromUndefinedOr(request.headers.viewer), (id) => ({ id })),
		),
	);
	const services = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: WireNotes,
			handlers: Layer.merge(moduleHandlers(WireNotes).pipe(Layer.provide(Layer.succeed(WireNotesStore, store))), caller),
			policy: "loopback",
			services: liveServerLayer.pipe(Layer.provideMerge(Reactivity.layer)),
		}),
	);
	const server = Context.get(services, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP listener");
	}
	const connection = makeClient(
		{ wireNotesClient: WireNotesClient },
		{
			headers: { viewer: VIEWER },
			runtime: yield* storyRuntime,
			url: `http://127.0.0.1:${server.address.port}/rpc`,
			webSocketConstructor: layerWebSocketConstructor,
		},
	);
	const api = connection.api.wireNotesClient;
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	function run<A, E>(effect: Effect.Effect<A, E, Context.Service.Identifier<typeof connection.Client> | Reactivity.Reactivity>) {
		return AtomRegistry.getResult(registry, connection.runtime.atom(effect));
	}
	return { api, registry, run, stored, viewer: VIEWER };
});
export type WireEngine = Effect.Success<typeof wireEngine>;
