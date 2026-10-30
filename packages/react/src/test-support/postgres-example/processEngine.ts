import { Effect, Redacted } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import type { privateClient } from "./privateClient.ts";
import { processClient } from "./processClient.ts";
import { startProcess } from "./startProcess.ts";

export const createProcesses = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const suffix = crypto.randomUUID().replaceAll("-", "");
	const configuration = {
		applicationName: `order_server_${suffix}`,
		channel: `order_changes_${suffix}`,
		databaseUrl: Redacted.value(database.url),
		ledger: `order_migrations_${suffix}`,
		queue: `order-save-${suffix}`,
		role: "server" as const,
		schema: `order_jobs_${suffix}`,
		table: `order_rows_${suffix}`,
	};
	const sql = yield* SqlClient.SqlClient;
	const privateSaving: { pending?: ReturnType<Awaited<ReturnType<typeof privateClient>>["save"]> } = {};
	const answers: string[] = [];
	return {
		answers,
		clients: new Map<string, Awaited<ReturnType<typeof processClient>>>(),
		configuration,
		marks: new Map<string, number>(),
		privateClients: new Map<string, Awaited<ReturnType<typeof privateClient>>>(),
		privateSaving,
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
	yield* Effect.promise(() => Promise.all([...engine.clients.values()].map((remote) => remote.hints.when((hints) => hints.length > 0))));
});
