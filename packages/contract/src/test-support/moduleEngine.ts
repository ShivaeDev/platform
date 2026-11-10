import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Context, Effect, Layer, Option, Ref, Tracer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { invalidationKeys, readKeys } from "@shivaedev/changes/keys.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { liveServerLayer } from "#live-server/layer.ts";
import { moduleHandlers } from "#moduleHandlers.ts";
import { CurrentViewer } from "#readPolicy.ts";
import { Caller, moduleNotes, Notes, NotesStore, type StoredNote, StoreUnavailable } from "#test/moduleNotes.ts";

export type Person = "alice" | "bob" | "anonymous";
export type Outage = "none" | "unavailable" | "defect";

export const moduleEngine = Effect.gen(function* () {
	const stored = yield* Ref.make<readonly StoredNote[]>([]);
	const state: { lookups: number; outage: Outage } = { lookups: 0, outage: "none" };
	const reactivity = yield* Reactivity.make;
	const heard: string[] = [];
	for (const id of [1, 2]) {
		reactivity.registerUnsafe(readKeys([moduleNotes.item(id)]), () => heard.push(`note ${id}`));
	}
	const available = Effect.suspend(() => {
		switch (state.outage) {
			case "unavailable":
				return Effect.fail(new StoreUnavailable());
			case "defect":
				return Effect.die(new Error("the notes store lost its index"));
			case "none":
				return Effect.void;
		}
	});
	const store = NotesStore.of({
		find: (id) =>
			Effect.sync(() => {
				state.lookups += 1;
			}).pipe(
				Effect.andThen(available),
				Effect.andThen(Ref.get(stored)),
				Effect.map((notes) => Option.fromNullishOr(notes.find((note) => note.id === id))),
			),
		insert: (title, owner) =>
			available.pipe(
				Effect.andThen(
					Ref.modify(stored, (notes) => {
						const note = { id: notes.length + 1, owner, title };
						return [note, [...notes, note]];
					}),
				),
				Effect.tap((note) => reactivity.invalidate(invalidationKeys([moduleNotes.item(note.id)]))),
			),
		owned: (owner) =>
			available.pipe(
				Effect.andThen(Ref.get(stored)),
				Effect.map((notes) => notes.filter((note) => note.owner === owner)),
			),
	});
	const spans: string[] = [];
	const tracer = Tracer.make({
		span: (options) => {
			spans.push(options.name);
			return new Tracer.NativeSpan(options);
		},
	});
	const caller = Layer.succeed(Caller, (effect, request) =>
		Effect.provideService(
			effect,
			CurrentViewer,
			Option.map(Option.fromUndefinedOr(request.headers.viewer), (id) => ({ id })),
		),
	);
	const services = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: Notes,
			handlers: Layer.merge(moduleHandlers(Notes).pipe(Layer.provide(Layer.succeed(NotesStore, store))), caller),
			policy: "loopback",
			services: liveServerLayer.pipe(Layer.provideMerge(Layer.succeed(Reactivity.Reactivity, reactivity))),
		}).pipe(Layer.provide(Layer.succeed(Tracer.Tracer, tracer))),
	);
	const server = Context.get(services, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP listener");
	}
	const url = `http://127.0.0.1:${server.address.port}/rpc`;
	function viewerHeaders(person: Person): Readonly<Record<string, string>> {
		return person === "anonymous" ? {} : { viewer: person };
	}
	function overHttp(person: Person) {
		const protocol = RpcClient.layerProtocolHttp({
			transformClient: (http) => HttpClient.mapRequest(http, HttpClientRequest.setHeaders(viewerHeaders(person))),
			url,
		}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
		return Effect.flatMap(Layer.build(protocol), (context) => RpcClient.make(Notes, { flatten: true }).pipe(Effect.provideContext(context)));
	}
	function overSocket() {
		const protocol = RpcClient.layerProtocolSocket().pipe(Layer.provide([layerWebSocket(url.replace(/^http/u, "ws")), RpcSerialization.layerNdjson]));
		return Effect.flatMap(Layer.build(protocol), (context) => RpcClient.make(Notes, { flatten: true }).pipe(Effect.provideContext(context)));
	}
	return { heard, overHttp, overSocket, spans, state, stored, viewerHeaders };
});
export type ModuleEngine = Effect.Success<typeof moduleEngine>;
