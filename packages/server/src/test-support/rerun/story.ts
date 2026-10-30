import { layerWebSocket, layerWebSocketConstructor } from "@effect/platform-node/NodeSocket";
import { Context, Effect, Fiber, Layer, Predicate, Stream, SubscriptionRef } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { type Rpc, RpcClient, type RpcGroup, RpcSerialization } from "effect/rpc";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { AppChanges } from "#appHost.ts";
import { close, context, start } from "#test/app-host/lifecycle.ts";
import { emptyHost } from "#test/app-host/state.ts";
import { Api, Note, type RerunState, rerunHost } from "./fixture.ts";
import { listen, until } from "./listener.ts";

type Update = Rpc.SuccessChunk<Rpc.ExtractTag<RpcGroup.Rpcs<typeof Api>, "rerun.$changes">>;
const create = Effect.gen(function* () {
	const state = {
		...emptyHost(),
		barrier: 0,
		calls: [],
		denied: new Set<string>(),
		notes: new Map([
			[1n, new Note({ id: 1n, owner: "alice", title: "One" })],
			[2n, new Note({ id: 2n, owner: "bob", title: "One of bob's" })],
			[3n, new Note({ id: 3n, owner: "alice", title: "Other" })],
		]),
	} satisfies RerunState;
	state.build = () => rerunHost(state);
	yield* Effect.addFinalizer(() => close(state).pipe(Effect.orDie));
	yield* start(state);
	const protocol = RpcClient.layerProtocolSocket().pipe(
		Layer.provide([
			layerWebSocket(`${state.url.replace(/^http/u, "ws")}/rpc`, { headers: { authorization: "alice" } }),
			RpcSerialization.layerNdjson,
		]),
	);
	const rpc = yield* Effect.flatMap(Layer.build(protocol), (services) =>
		RpcClient.make(Api, { flatten: true }).pipe(Effect.provideContext(services)),
	);
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const client = makeClient(Api, { headers: { authorization: "alice" }, url: `${state.url}/rpc`, webSocketConstructor: layerWebSocketConstructor });
	const mixed = yield* SubscriptionRef.make<readonly Update[]>([]);
	const { updates, finished } = yield* listen(
		rpc("rerun.$changes", {
			queries: [
				{ payload: { title: "One" }, query: "compare" },
				{ payload: undefined, query: "barrier" },
			],
		}),
		(all) => all.some((update) => update._tag === "Result" && update.query === "barrier"),
	);
	return { client, finished, mixed, registry, rpc, state, updates };
});
export const rerunStory = storyKit({
	clock: "live",
	create: () => create,
	inspect: ({ state }) => ({ calls: state.calls, denied: [...state.denied], notes: [...state.notes.values()] }),
	name: "rerun-and-compare over WebSocket",
	stages: ["page"],
	verbs: (engine, story) => ({
		arrivals: () =>
			Effect.map(SubscriptionRef.get(engine.updates), (all) =>
				all.flatMap((update) => (update._tag === "Result" && update.query === "barrier" ? [] : [update])),
			),
		clientReads: () => Effect.sync(() => engine.state.calls.filter((tag) => tag === "rerun.compare" || tag === "rerun.hinted")),
		denyAlice: () => Effect.sync(() => engine.state.denied.add("alice")),
		mixedArrivals: () => SubscriptionRef.get(engine.mixed),
		openHinted: () =>
			Effect.gen(function* () {
				const atom = engine.client.api.hinted.query({ title: "One" });
				engine.registry.mount(atom);
				yield* AtomRegistry.getResult(engine.registry, atom);
			}),
		pageEnd: () =>
			AtomRegistry.toStreamResult(engine.registry, engine.client.api.compare.query({ title: "One" })).pipe(
				Stream.runDrain,
				Effect.match({
					onFailure: (error) => (Predicate.isTagged(error, "QueryReadDenied") ? "read denied" : String(error)),
					onSuccess: () => "still readable",
				}),
			),
		rename: (id: bigint, title: string) => {
			story.tell(`rename note ${id} to ${title}`);
			return engine.rpc("rerun.rename", { id, title });
		},
		resync: () => Effect.flatMap(context(engine.state), (services) => Context.getUnsafe(services, AppChanges).resync),
		shown: () => AtomRegistry.getResult(engine.registry, engine.client.api.compare.query({ title: "One" })),
		subscriptionEnd: () =>
			Fiber.join(engine.finished).pipe(
				Effect.match({
					onFailure: (error) => (Predicate.isTagged(error, "QueryReadDenied") ? "read denied" : String(error)),
					onSuccess: () => "completed",
				}),
			),
		untilChanged: () =>
			until(
				SubscriptionRef.changes(engine.updates),
				(all) => all.filter((update) => update._tag === "Result" && update.query === "barrier").length > 1,
			),
		untilHinted: (title: string) =>
			AtomRegistry.toStreamResult(engine.registry, engine.client.api.hinted.query({ title: "One" })).pipe(
				Stream.filter((rows) => rows.some((note) => note.title === title)),
				Stream.runHead,
			),
		untilMixedHint: () => until(SubscriptionRef.changes(engine.mixed), (all) => all.some((update) => update._tag === "Changed")),
		untilShown: (title: string) =>
			AtomRegistry.toStreamResult(engine.registry, engine.client.api.compare.query({ title: "One" })).pipe(
				Stream.filter((rows) => rows.some((note) => note.title === title)),
				Stream.runHead,
			),
	}),
});
export const pageOpen = rerunStory.trait("page", "alice opens her notes filtered to One", (engine) =>
	Effect.gen(function* () {
		const atom = engine.client.api.compare.query({ title: "One" });
		engine.registry.mount(atom);
		yield* AtomRegistry.getResult(engine.registry, atom);
	}),
);

export const mixedSubscription = rerunStory.trait("page", "alice subscribes to a compared query and a hinted query in the same bucket", (engine) =>
	Effect.gen(function* () {
		const listener = yield* listen(
			engine.rpc("rerun.$changes", {
				queries: [
					{ payload: { title: "One" }, query: "compare" },
					{ payload: { title: "One" }, query: "hinted" },
				],
			}),
			(all) => all.some((update) => update._tag === "Resync"),
		);
		engine.mixed = listener.updates;
	}),
);
