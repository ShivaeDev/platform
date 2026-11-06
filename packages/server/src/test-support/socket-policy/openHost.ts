import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Effect, Layer, Option } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { appHost } from "#appDatabase.ts";
import { Api, ManageNotes } from "./feature.ts";
import { handlers, migrations } from "./handlers.ts";

export const openHost = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const access = { admin: true };
	const sessions = Layer.succeed(SessionPolicy, {
		origin: () => true,
		provider: {
			get: (headers) =>
				Effect.sync(() => {
					const id = headers.authorization;
					if (id === undefined) {
						return Option.none();
					}
					const user = {
						email: `${id}@example.test`,
						id,
						name: id,
						permissions: id === "admin" && access.admin ? [ManageNotes] : [],
					};
					return Option.some({ user });
				}),
		},
		streamRevalidationInterval: "1 hour",
	});
	const services = yield* Layer.build(
		appHost({ config: { databaseUrl: database.url, port: 0 }, group: Api, handlers, migrations, postgresSettings: {}, sessions }),
	);
	const { address } = yield* HttpServer.HttpServer.pipe(Effect.provideContext(services));
	if (!NetAddress.isInetAddress(address)) {
		return yield* Effect.die("Expected a TCP host");
	}
	const url = `ws://127.0.0.1:${address.port}/rpc`;
	function client(caller: string) {
		return Effect.flatMap(
			Layer.build(
				RpcClient.layerProtocolSocket().pipe(
					Layer.provide([layerWebSocket(url, { headers: { authorization: caller } }), RpcSerialization.layerNdjson]),
				),
			),
			(protocol) => RpcClient.make(Api, { flatten: true }).pipe(Effect.provideContext(protocol)),
		);
	}
	return { access, client };
});
