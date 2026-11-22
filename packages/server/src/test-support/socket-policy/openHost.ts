import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Effect, Layer, Option } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";
import { liveSyncRpc } from "@shivaedev/contract/liveSyncRpc.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { appHost } from "#appDatabase.ts";
import { Api, ManageNotes } from "#test/socket-policy/feature.ts";
import { handlers, migrations } from "#test/socket-policy/handlers.ts";
import { roleView } from "#test/socket-policy/role/service.ts";

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
						emailVerified: true,
						id,
						name: id,
						permissions: id === "admin" && access.admin ? [ManageNotes] : [],
						role: id === "admin" && access.admin ? "admin" : "reader",
					};
					return Option.some({ user });
				}),
		},
		streamRevalidationInterval: "1 hour",
	});
	const services = yield* Layer.build(
		appHost({
			config: { databaseUrl: database.url, port: 0 },
			group: Api,
			handlers,
			migrations,
			postgresSettings: {},
			requestServices: roleView.layer,
			sessions,
		}),
	);
	const { address } = yield* HttpServer.HttpServer.pipe(Effect.provideContext(services));
	if (!NetAddress.isInetAddress(address)) {
		return yield* Effect.die("Expected a TCP host");
	}
	const url = `ws://127.0.0.1:${address.port}/rpc`;
	const group = RpcGroup.make(...Api.requests.values(), ...liveSyncRpc.requests.values()).annotateMerge(Api.annotations);
	function client(caller: string) {
		return Effect.flatMap(
			Layer.build(
				RpcClient.layerProtocolSocket().pipe(
					Layer.provide([layerWebSocket(url, { headers: { authorization: caller } }), RpcSerialization.layerNdjson]),
				),
			),
			(protocol) => RpcClient.make(group, { flatten: true }).pipe(Effect.provideContext(protocol)),
		);
	}
	return { access, client };
});
