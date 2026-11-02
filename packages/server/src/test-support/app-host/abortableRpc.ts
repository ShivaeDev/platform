import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { Migrator, SqlClient } from "effect/sql";
import { LiveServer } from "@shivaedev/contract/LiveServer.ts";
import { appHost } from "#appHost.ts";
import { AbortApi, abortHandlers, CHANGED_KEY, type ClientAbortState, changed } from "./clientAbortFixture.ts";
import { databaseOf } from "./state.ts";
import { postgresHost } from "./story.ts";

export function abortableRpc(mode: "transaction" | "subscription") {
	return postgresHost.trait("configured", `a PostgreSQL host serves an abortable ${mode}`, function* (state) {
		const databaseUrl = databaseOf(state).url;
		const table = "abort_items";
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
			waiters: [],
			written: false,
		};
		state.clientAbort = probe;
		state.minimumLogLevel = "Debug";
		const application = Effect.gen(function* () {
			const reactivity = yield* Reactivity.Reactivity;
			const register = reactivity.registerUnsafe;
			const stopObserving = register([CHANGED_KEY], () => {
				probe.commits += 1;
				changed(probe);
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
						changed(probe);
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
			const singleConnection = LiveServer.layer.pipe(
				Layer.provideMerge(Reactivity.layer),
				Layer.provideMerge(PgClient.layer({ applicationName: table, maxConnections: 1, url: databaseUrl })),
			);
			return mode === "subscription"
				? appHost({ application, config, migrations })
				: Layer.unwrap(Effect.map(application, (options) => appHost(options))).pipe(Layer.provideMerge(singleConnection));
		};
	});
}
