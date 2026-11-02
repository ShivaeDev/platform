import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { postgresMigration } from "@shivaedev/rate-limit/adapters/postgresMigration.ts";
import { postgresStore } from "@shivaedev/rate-limit/adapters/postgresStore.ts";
import { clientOptions } from "@shivaedev/sql/clientOptions.ts";
import { postgresLayer } from "@shivaedev/sql/postgresLayer.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { clientIpHost } from "./clientIpHost.ts";

export const signInLimits = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		yield* postgresMigration;
		const database = yield* PostgresTestDatabase;
		const remote = postgresStore.pipe(Layer.provide(postgresLayer(database.url, clientOptions({ maxConnections: 2 }))));
		const env = { "TRUSTED_PROXY": "127.0.0.1" };
		const localStore = yield* Layer.build(Layer.fresh(postgresStore));
		const remoteStore = yield* Layer.build(remote);
		const first = yield* clientIpHost(env).pipe(Effect.provideContext(localStore));
		const second = yield* clientIpHost(env).pipe(Effect.provideContext(remoteStore));
		return { hosts: { first: first.baseUrl, second: second.baseUrl }, sql: yield* SqlClient.SqlClient };
	},
	layer: postgres,
	name: "sign-in limits across PostgreSQL hosts",
	runIf: databaseUrl !== undefined,
	stages: [],
	verbs: (engine, story) => ({
		signIn: (host: "first" | "second", client: "alice" | "bob" = "alice") => {
			story.tell(`${client} attempts email sign-in on the ${host} host`);
			return Effect.promise(async () => {
				const baseUrl = engine.hosts[host];
				const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
					body: JSON.stringify({ email: `${client}@example.test`, password: "wrong-password" }),
					headers: {
						"content-type": "application/json",
						origin: baseUrl,
						"x-forwarded-for": client === "alice" ? "198.51.100.10" : "198.51.100.20",
					},
					method: "POST",
				});
				await response.text();
				return { retryAfter: response.headers.get("x-retry-after"), status: response.status };
			});
		},
		storageUnavailable: () => {
			story.tell("the shared rate-limit table becomes unavailable");
			return engine.sql`drop table rate_limit_windows`;
		},
	}),
});
