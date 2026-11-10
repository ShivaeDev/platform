import { Clock, Context, Effect, Layer, Option, Ref } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { appHost } from "@shivaedev/server/appHost.ts";
import { bind } from "#bind.ts";
import { liveServerLayer } from "#live-server/layer.ts";
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
	const url = `http://127.0.0.1:${server.address.port}/rpc`;
	class Browser extends AtomRpc.Service<Browser>()("test/WireNotesBrowser", {
		group: WireNotesClient,
		protocol: RpcClient.layerProtocolHttp({
			transformClient: (http) => HttpClient.mapRequest(http, HttpClientRequest.setHeader("viewer", VIEWER)),
			url,
		}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
		runtime: yield* storyRuntime,
	}) {}
	const api = bind(WireNotesClient, Browser, { live: false });
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	function run<A, E>(effect: Effect.Effect<A, E, Browser | Reactivity.Reactivity>) {
		return AtomRegistry.getResult(registry, Browser.runtime.atom(effect));
	}
	return { api, registry, run, stored, viewer: VIEWER };
});
export type WireEngine = Effect.Success<typeof wireEngine>;
