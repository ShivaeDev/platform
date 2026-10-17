import { Context, Effect, Exit, Layer, Redacted, Scope } from "effect";
import { SqlClient } from "effect/sql";
import * as TestClock from "effect/testing/TestClock";
import { expect } from "vitest";
import { adminUrl, integration, runAdmin, setup } from "#test/postgres.ts";
import { PostgresTestDatabase } from "./database.ts";
import { makePostgresTestLayer } from "./postgres.ts";
import { withIsolatedDatabase } from "./withIsolatedDatabase.ts";

integration("the admin session survives idle fixture periods and scope close drops every database", () =>
	runAdmin(
		Effect.gen(function* () {
			const admin = yield* SqlClient.SqlClient;
			const marker = `fixture_admin_${crypto.randomUUID().replaceAll("-", "")}`;
			const url = new URL(Redacted.value(adminUrl));
			url.searchParams.set("application_name", marker);
			const kit = setup();
			let template = "";
			const layer = makePostgresTestLayer({
				...kit.options,
				fixtures: Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const [row] = yield* sql<{ name: string }>`select current_database() as name`;
					template = row?.name ?? "";
				}),
				url: Redacted.make(url.toString()),
			}).pipe(Layer.provideMerge(TestClock.layer()));
			const scope = yield* Effect.acquireRelease(Scope.make(), (value) => Scope.close(value, Exit.void));
			const services = yield* Layer.buildWithScope(layer, scope);
			const shared = new URL(Redacted.value(Context.get(services, PostgresTestDatabase).url)).pathname.slice(1);
			yield* Context.get(services, SqlClient.SqlClient)`select 1`;
			yield* TestClock.adjust("61 seconds").pipe(Effect.provideContext(services));
			function connections(database: string) {
				return admin<{ total: number }>`select count(*)::int as total from pg_stat_activity
					where application_name = ${marker} and datname = ${database}`.pipe(Effect.map(([row]) => row?.total));
			}
			yield* Effect.gen(function* () {
				while ((yield* connections(shared)) !== 0) {
					yield* Effect.sleep("10 millis");
				}
			}).pipe(Effect.timeout("5 seconds"));
			const idleAdminConnections = yield* connections(url.pathname.slice(1));
			let isolated = "";
			yield* withIsolatedDatabase(
				Effect.gen(function* () {
					const database = yield* PostgresTestDatabase;
					isolated = new URL(Redacted.value(database.url)).pathname.slice(1);
				}),
			).pipe(Effect.provideContext(services));
			yield* Scope.close(scope, Exit.void);
			expect(idleAdminConnections).toBe(1);
			expect(yield* connections(url.pathname.slice(1))).toBe(0);
			expect([template, shared, isolated].every((name) => name !== "")).toBe(true);
			for (const name of [template, shared, isolated]) {
				expect(yield* admin`select datname from pg_database where datname = ${name}`).toEqual([]);
			}
		}),
	),
);
