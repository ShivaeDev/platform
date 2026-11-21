import { layerWebSocketConstructor } from "@effect/platform-node/NodeSocket";
import { Clock, Context, Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcGroup } from "effect/rpc";
import { appHost } from "@shivaedev/server/appHost.ts";
import { clientActivity } from "#clientActivity.ts";
import { liveServerLayer } from "#live-server/layer.ts";
import { makeClient } from "#makeClient.ts";
import { SocketClock } from "#SocketClock.ts";
import { Shelf } from "#test/record-client/Shelf.ts";
import { Tally } from "#test/record-client/Tally.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

export const recordClientEngine = Effect.gen(function* () {
	const runtime = yield* storyRuntime;
	runtime.addGlobalLayer(Layer.succeed(SocketClock, yield* Clock.Clock));
	const titles: readonly string[] = [];
	const stored = { count: 0, titles };
	const reactivity = yield* Reactivity.make;
	const handlers = Layer.merge(
		Shelf.application.toLayer({
			"shelf.shelve": ({ title }) =>
				Effect.sync(() => {
					stored.titles = [...stored.titles, title];
				}),
			"shelf.titles": () => Effect.sync(() => stored.titles),
		}),
		Tally.application.toLayer({
			"tally.bump": () =>
				Effect.sync(() => {
					stored.count += 1;
				}),
			"tally.count": () => Effect.sync(() => stored.count),
		}),
	);
	const services = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: RpcGroup.make().merge(Shelf, Tally),
			handlers,
			policy: "loopback",
			services: liveServerLayer.pipe(Layer.provideMerge(Layer.succeed(Reactivity.Reactivity, reactivity))),
		}),
	);
	const server = Context.get(services, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP listener");
	}
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const origin = `http://127.0.0.1:${server.address.port}`;
	const options = { runtime, webSocketConstructor: layerWebSocketConstructor };
	const client = makeClient({ shelf: Shelf, tally: Tally }, { ...options, url: `${origin}/rpc` });
	const views = { count: client.api.tally.count.query(), titles: client.api.shelf.titles.query() };
	return { activity: clientActivity(client), client, options, origin, registry, views };
});

export type RecordClientEngine = Effect.Success<typeof recordClientEngine>;
