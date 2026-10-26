import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Effect, Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { Migrator, SqlClient } from "effect/sql";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { AppChanges, appHost } from "#server/appHost.ts";
import { AbortApi, abortHandlers, CHANGED_KEY, type ClientAbortState } from "./clientAbortFixture.ts";
import { host } from "./story.ts";

export function abortableRpc(mode: "transaction" | "subscription") {
	return host.trait("configured", `a PostgreSQL host serves an abortable ${mode}`, function* (state) {
		const databaseUrl = yield* Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL");
		const table = `abort_${crypto.randomUUID().replaceAll("-", "")}`;
		const ledger = `${table}_migrations`;
		const probe: ClientAbortState = {
			applicationName: table,
			callbacks: 0,
			commits: 0,
			controller: new AbortController(),
			finalized: false,
			interrupted: false,
			registrations: [],
			table,
			written: false,
		};
		state.clientAbort = probe;
		state.minimumLogLevel = "Debug";
		state.cleanup.push(() =>
			Effect.runPromise(
				SqlClient.SqlClient.use((sql) => sql`drop table if exists ${sql(table)}, ${sql(ledger)}`).pipe(
					Effect.provide(PgClient.layer({ url: databaseUrl })),
					Effect.asVoid,
				),
			),
		);
		const application = Effect.gen(function* () {
			const reactivity = yield* Reactivity.Reactivity;
			const register = reactivity.registerUnsafe;
			const stopObserving = register([CHANGED_KEY], () => {
				probe.commits += 1;
			});
			yield* Effect.addFinalizer(() => Effect.sync(stopObserving));
			Object.assign(reactivity, {
				registerUnsafe: (keys: Parameters<typeof register>[0], callback: () => void) => {
					probe.registrations.push(keys);
					const stop = register(keys, () => {
						probe.callbacks += 1;
						callback();
					});
					return () => {
						stop();
						probe.registrations.splice(probe.registrations.indexOf(keys), 1);
					};
				},
			});
			return {
				config: state.config,
				group: AbortApi,
				handlers: abortHandlers(probe),
				policy: "loopback" as const,
				services: Layer.empty,
			};
		});
		const config = { applicationName: table, databaseUrl, maxConnections: mode === "transaction" ? 1 : 2 };
		const migrations = {
			loader: Migrator.fromRecord({ "001_items": SqlClient.SqlClient.use((sql) => sql`create table ${sql(table)} (value text not null)`) }),
			table: ledger,
		};
		if (mode === "transaction") {
			yield* SqlClient.SqlClient.use((sql) => sql`create table ${sql(table)} (value text not null)`).pipe(
				Effect.provide(PgClient.layer({ url: databaseUrl })),
			);
		}
		state.build = () => {
			const singleConnection = Layer.effect(AppChanges, makeLiveServer).pipe(
				Layer.provideMerge(Reactivity.layer),
				Layer.provideMerge(PgClient.layer({ applicationName: table, maxConnections: 1, url: databaseUrl })),
			);
			return mode === "subscription"
				? appHost({ application, config, migrations })
				: Layer.unwrap(Effect.map(application, (options) => appHost(options))).pipe(Layer.provideMerge(singleConnection));
		};
	});
}
