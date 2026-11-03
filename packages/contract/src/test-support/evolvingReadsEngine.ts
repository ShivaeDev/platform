import { layerWebSocket, layerWebSocketConstructor } from "@effect/platform-node/NodeSocket";
import { Context, Effect, Fiber, Layer, Option, Stream, SubscriptionRef } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { appHost } from "@shivaedev/server/appHost.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { LiveConnection } from "#automaticLive.ts";
import { makeClient } from "#bind.ts";
import { LiveServer } from "#LiveServer.ts";
import type { QueryUpdate } from "#queryUpdate.ts";
import { authorizeReads } from "#readPolicy.ts";
import { Guard, TimelineData, Unavailable } from "./derivedReadsContract.ts";
import { derivedReadsData } from "./derivedReadsData.ts";
import { EvolvingTimelines } from "./evolvingReadsContract.ts";

export const evolvingReadsEngine = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const reactivity = yield* Reactivity.make;
	const registrations = new Map<unknown, number>();
	const tracked = {
		...reactivity,
		registerUnsafe: (...[keys, run]: Parameters<typeof reactivity.registerUnsafe>) => {
			const cancel = reactivity.registerUnsafe(keys, run);
			const names = Array.isArray(keys) ? keys : Object.keys(keys);
			for (const key of names) {
				registrations.set(key, (registrations.get(key) ?? 0) + 1);
			}
			return () => {
				cancel();
				for (const key of names) {
					registrations.set(key, (registrations.get(key) ?? 0) - 1);
				}
			};
		},
	};
	const { create, data, edit } = yield* derivedReadsData.pipe(Effect.provideService(Reactivity.Reactivity, tracked));
	const handlers = EvolvingTimelines.application
		.toLayer({
			"evolving.addRecord": ({ body, id, listId }) =>
				sql`insert into records values (${id}, ${listId}, ${body})`.pipe(
					Effect.asVoid,
					Effect.catchTag("SqlError", () => Effect.fail(new Unavailable())),
				),
			"evolving.barrier": () =>
				sql<{ body: string }>`select body from records order by id`.pipe(
					Effect.map((rows) => rows.map(({ body }) => body)),
					Effect.catchTag("SqlError", () => Effect.fail(new Unavailable())),
				),
			"evolving.create": create,
			"evolving.edit": edit,
			"evolving.join": ({ id, scope }) =>
				sql`insert into lists values (${id}, ${scope})`.pipe(
					Effect.asVoid,
					Effect.catchTag("SqlError", () => Effect.fail(new Unavailable())),
				),
			"evolving.leave": ({ id, scope }) =>
				sql`update lists set scope = 'departed' where id = ${id} and scope = ${scope}`.pipe(
					Effect.asVoid,
					Effect.catchTag("SqlError", () => Effect.fail(new Unavailable())),
				),
			"evolving.pushed": ({ scope }) => Effect.flatMap(TimelineData, (current) => current.load(scope)),
			"evolving.timeline": ({ scope }) => Effect.flatMap(TimelineData, (current) => current.load(scope)),
		})
		.pipe(Layer.provide(data));
	const services = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: EvolvingTimelines,
			handlers: Layer.merge(
				handlers,
				Layer.succeed(Guard, (effect, request) => authorizeReads(effect, request, Option.some({ id: "alice" }))),
			),
			policy: "loopback",
			services: Layer.merge(data, LiveServer.layer.pipe(Layer.provideMerge(Layer.succeed(Reactivity.Reactivity, tracked)))),
		}),
	);
	const server = Context.get(services, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP listener");
	}
	const url = `http://127.0.0.1:${server.address.port}/rpc`;
	const connection = makeClient(EvolvingTimelines, { url, webSocketConstructor: layerWebSocketConstructor });
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	registry.set(connection.api[LiveConnection].coalesceWindow, 0);
	const protocol = RpcClient.layerProtocolSocket().pipe(Layer.provide([layerWebSocket(url.replace(/^http/u, "ws")), RpcSerialization.layerNdjson]));
	const transport = yield* Layer.build(protocol);
	const rpc = yield* RpcClient.make(EvolvingTimelines, { flatten: true }).pipe(Effect.provideContext(transport));
	const updates = yield* SubscriptionRef.make<readonly QueryUpdate[]>([]);
	const finished = yield* rpc("evolving.$changes", {
		queries: [
			{ payload: { scope: "alice" }, query: "timeline" },
			{ payload: { scope: "alice" }, query: "pushed" },
			{ payload: undefined, query: "barrier" },
		],
	}).pipe(
		Stream.runForEach((update) => SubscriptionRef.update(updates, (all) => [...all, update])),
		Effect.forkScoped,
	);
	yield* until(SubscriptionRef.changes(updates), (all) => all.some((update) => update._tag === "Result" && update.query === "barrier"), {
		name: "open timeline subscription",
	}).pipe(Effect.raceFirst(Fiber.join(finished).pipe(Effect.andThen(Effect.die("Subscription ended before opening")))));
	return { api: connection.api, finished, registrations, registry, rpc, sql, updates };
});
