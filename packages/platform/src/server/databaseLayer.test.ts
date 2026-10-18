import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, ConfigProvider, Effect, Layer, Redacted, Tracer } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { expect, it } from "vitest";
import { AppChanges } from "#server/appHost.ts";
import { databaseLayer } from "./databaseLayer.ts";

const database = Effect.runSync(Config.String("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL").pipe(Config.option));

it.runIf(database._tag === "Some").each(["authority", "parameters"] as const)(
	"SQL spans use the DATABASE_URL %s address without changing the connection",
	async (source) => {
		if (database._tag === "None") {
			throw new Error("PostgreSQL URL is required");
		}
		const url = new URL(database.value);
		url.hostname = "127.0.0.1";
		const port = Number(url.port);
		if (source === "parameters") {
			url.searchParams.set("host", url.hostname);
			url.searchParams.set("port", url.port);
			url.hostname = "unused.invalid";
			url.port = "1";
		}
		const spans: Tracer.NativeSpan[] = [];
		const tracer = Tracer.make({
			span: (options) => {
				const span = new Tracer.NativeSpan(options);
				spans.push(span);
				return span;
			},
		});
		const layer = databaseLayer({ migrations: { loader: Migrator.fromRecord({}) } }, AppChanges).pipe(
			Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "DATABASE_URL": url.toString() } }))),
		);
		const connection = SqlClient.SqlClient.use(
			(sql) => sql`select inet_server_addr()::text as address, inet_server_port() as port, current_database() as database`,
		);
		const expected = await Effect.runPromise(connection.pipe(Effect.provide(PgClient.layer({ url: Redacted.make(url.toString()) }))));
		const rows = await Effect.runPromise(
			Effect.gen(function* () {
				const client = yield* PgClient.PgClient;
				expect(Redacted.isRedacted(client.config.url)).toBe(true);
				return yield* connection;
			}).pipe(Effect.provide(layer), Effect.provideService(Tracer.Tracer, tracer)),
		);
		expect(rows).toEqual(expected);
		const query = spans.find((span) => String(span.attributes.get("db.query.text")).includes("inet_server_addr"));
		expect(query).toBeDefined();
		expect(query?.attributes.get("server.address")).toBe("127.0.0.1");
		expect(query?.attributes.get("server.port")).toBe(port);
		const attributes = JSON.stringify(spans.map((span) => Object.fromEntries(span.attributes)));
		expect(attributes).not.toContain(url.toString());
		expect(attributes).not.toContain(`${url.username}:${url.password}`);
	},
);
