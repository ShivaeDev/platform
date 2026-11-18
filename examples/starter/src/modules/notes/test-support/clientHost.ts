import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import type * as Reactivity from "effect/reactivity/Reactivity";
import { type Rpc, type RpcGroup, RpcSerialization, RpcServer } from "effect/rpc";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { commandGuardLayer, guardCommands } from "@shivaedev/contract/CommandGuard.ts";
import { Activity, clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { LiveSync } from "@shivaedev/contract/LiveSync.ts";
import { liveServerLayer } from "@shivaedev/contract/live-server/layer.ts";
import type { AuthenticatedUser } from "@shivaedev/identity/middleware.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import { liveSyncLayer } from "@shivaedev/server/liveSyncLayer.ts";
import { publishCommand } from "@shivaedev/server/publishCommand.ts";
import { browserReads } from "@shivaedev/test-story/server/browserReads.ts";
import { Notes } from "#generated/modules/notes/Notes.ts";
import { Notes as NotesModule } from "#modules/notes/Notes.ts";

export const notesClientHost = Effect.fnUntraced(function* (
	handlers: Layer.Layer<Rpc.ToHandler<RpcGroup.Rpcs<typeof Notes.application>>>,
	authentication: Layer.Layer<AuthenticatedUser>,
	services: Layer.Layer<Reactivity.Reactivity>,
) {
	const live = yield* Layer.build(liveServerLayer.pipe(Layer.provideMerge(services)));
	// The browser contract carries no read policies, so the fake serves the module the host reruns queries under.
	const changes = hostChanges(NotesModule).pipe(Layer.provide(handlers), Layer.provide(Layer.succeedContext(live)));
	// The guard and the sync command make the fake confirm each command on the client's live queries, as the application host does.
	const guarded = yield* guardCommands(NotesModule.merge(LiveSync.application));
	const confirmed = commandGuardLayer((effect, keys, sync) => Effect.provide(publishCommand(effect, keys, sync), live));
	const routes = RpcServer.layerHttp({ group: guarded, path: "/rpc", protocol: "websocket" }).pipe(
		Layer.provide([handlers, changes, liveSyncLayer, confirmed, authentication, RpcSerialization.layerNdjson]),
	);
	const context = yield* Layer.build(
		HttpRouter.serve(routes, { disableLogger: true }).pipe(Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 }))),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provide(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP notes host");
	}
	const url = `http://127.0.0.1:${server.address.port}/rpc`;
	const observed = yield* browserReads({ contracts: [Notes], url, webSocketConstructor: layerWebSocketConstructor });
	const client = makeClient(Notes, { protocol: observed.protocol, url });
	return { api: client.api, observed, runtime: client.runtime, sync: client.sync, [Activity]: clientActivity(client) };
});
