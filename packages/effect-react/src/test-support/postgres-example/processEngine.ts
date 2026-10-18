import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Redacted } from "effect";
import { SqlClient } from "effect/sql";
import { databaseUrl } from "#test/order-example/postgres.ts";
import { processClient } from "./processClient.ts";
import { startProcess, until } from "./processHarness.ts";

export const observerLayer = PgClient.layer({ url: Redacted.make(databaseUrl._tag === "Some" ? databaseUrl.value : "") });
export const createProcesses = Effect.gen(function* () {
	if (databaseUrl._tag === "None") {
		return yield* Effect.die("PostgreSQL URL required");
	}
	const suffix = crypto.randomUUID().replaceAll("-", "");
	const configuration = {
		applicationName: `order_server_${suffix}`,
		channel: `order_changes_${suffix}`,
		databaseUrl: databaseUrl.value,
		ledger: `order_migrations_${suffix}`,
		queue: `order-save-${suffix}`,
		role: "server" as const,
		schema: `order_jobs_${suffix}`,
		table: `order_rows_${suffix}`,
	};
	const sql = yield* SqlClient.SqlClient;
	const beforeRollback: number[] = [];
	yield* Effect.addFinalizer(() =>
		Effect.all([
			sql`drop table if exists ${sql(configuration.table)}, ${sql(configuration.ledger)}`,
			sql`drop schema if exists ${sql(configuration.schema)} cascade`,
		]).pipe(Effect.orDie),
	);
	return {
		anotherBeforeLoss: 0,
		beforeRollback,
		clients: new Map<string, Awaited<ReturnType<typeof processClient>>>(),
		configuration,
		servers: new Map<string, Awaited<ReturnType<typeof startProcess>>>(),
		sql,
	};
});
export type ProcessEngine = Effect.Success<typeof createProcesses>;
export function client(engine: ProcessEngine, name: string) {
	const found = engine.clients.get(name);
	if (found === undefined) {
		throw new Error(`Missing client ${name}`);
	}
	return found;
}
export function process(engine: ProcessEngine, name: string) {
	const found = engine.servers.get(name);
	if (found === undefined) {
		throw new Error(`Missing process ${name}`);
	}
	return found;
}
export const openCluster = Effect.fn("OrderProcesses.openCluster")(function* (engine: ProcessEngine) {
	for (const name of ["first", "second", "worker"]) {
		const configuration = {
			...engine.configuration,
			applicationName: name === "second" ? `${engine.configuration.applicationName}_second` : engine.configuration.applicationName,
			role: name === "worker" ? ("worker" as const) : ("server" as const),
		};
		const server = yield* Effect.acquireRelease(
			Effect.promise(() => startProcess(configuration)),
			(opened) => Effect.promise(opened.close),
		);
		engine.servers.set(name, server);
	}
	for (const [name, server] of [
		["a", "first"],
		["b", "second"],
		["another", "first"],
	] as const) {
		const remote = yield* Effect.acquireRelease(
			Effect.promise(() => processClient(process(engine, server).url)),
			(connected) => Effect.promise(connected.close),
		);
		engine.clients.set(name, remote);
	}
	yield* Effect.promise(() => until(() => [...engine.clients.values()].every((remote) => remote.hints.length > 0)));
});
