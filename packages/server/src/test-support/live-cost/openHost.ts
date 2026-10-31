import { Effect, Layer, Option } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { appHost } from "#appHost.ts";
import { Api, Cost, handlers, migrations } from "./feature.ts";

export const openHost = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const sql = yield* SqlClient.SqlClient;
	const cost = { checks: 0, lookups: 0, reruns: 0 };
	const sessions = {
		origin: () => true,
		provider: {
			get: (headers: Readonly<Record<string, string>>) =>
				Effect.gen(function* () {
					cost.lookups += 1;
					const rows = yield* sql<{ id: string }>`select id from cost_sessions where id = ${headers.authorization ?? ""}`.pipe(Effect.orDie);
					return Option.map(Option.fromUndefinedOr(rows[0]), (user) => ({ user }));
				}),
		},
		streamRevalidationInterval: "1 hour" as const,
	};
	const services = yield* Layer.build(
		appHost({
			config: { databaseUrl: database.url, port: 0 },
			group: Api,
			handlers,
			migrations,
			services: Layer.succeed(Cost, cost),
			sessions,
		}),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(services));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected TCP address");
	}
	return { cost, services, url: `http://127.0.0.1:${server.address.port}/rpc` };
});
