import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Context, Effect, Layer, Option } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { makeCapture } from "@shivaedev/changes/capture.ts";
import { appDatabase } from "@shivaedev/server/appDatabase.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { ChangeObserver } from "@shivaedev/sql/transact.ts";
import { watchHints } from "@shivaedev/test-kits/contract/testing.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { CurrentViewer } from "#readPolicy.ts";
import { handlers, migrations, Pots, Viewer } from "./fixture.ts";

export const engine = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const capture = yield* makeCapture<unknown>();
	const databaseServices = yield* Layer.build(appDatabase({ config: { databaseUrl: database.url }, migrations, postgresSettings: {} })).pipe(
		Effect.provide(capture.layer(ChangeObserver)),
	);
	const services = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: Pots,
			handlers: Layer.merge(
				handlers,
				Layer.succeed(Viewer, (effect, { headers }) => Effect.provideService(effect, CurrentViewer, Option.some({ id: headers.viewer ?? "alice" }))),
			),
			policy: "loopback",
			services: Layer.succeedContext(databaseServices),
		}).pipe(Layer.provide(capture.layer(ChangeObserver))),
	);
	const server = Context.get(services, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP listener");
	}
	const url = `http://127.0.0.1:${server.address.port}/rpc`;
	function open(viewer: string) {
		return Effect.gen(function* () {
			const http = RpcClient.layerProtocolHttp({
				transformClient: (httpClient) => HttpClient.mapRequest(httpClient, HttpClientRequest.setHeader("viewer", viewer)),
				url,
			}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
			const httpContext = yield* Layer.build(http);
			const client = yield* RpcClient.make(Pots, { flatten: true }).pipe(Effect.provideContext(httpContext));
			const socket = RpcClient.layerProtocolSocket().pipe(Layer.provide([layerWebSocket(url.replace(/^http/u, "ws")), RpcSerialization.layerNdjson]));
			const socketContext = yield* Layer.build(socket);
			const live = yield* RpcClient.make(Pots, { flatten: true }).pipe(Effect.provideContext(socketContext));
			const hints = yield* watchHints(live("pots.$changes", { queries: [{ payload: undefined, query: "list" }] }, { headers: { viewer } }));
			return { client, hints };
		});
	}
	const viewers = { alice: yield* open("alice"), bob: yield* open("bob"), carol: yield* open("carol"), dana: yield* open("dana") };
	return { publications: capture.attempted, viewers };
});
