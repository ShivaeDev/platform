import { Deferred, Effect } from "effect";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { client, type ProcessEngine, process } from "./processEngine.ts";
import { until } from "./processHarness.ts";

export function failoverVerbs(engine: ProcessEngine, tell: (line: string) => void) {
	const pendingReads = new Map<string, ReturnType<ReturnType<typeof client>["getResult"]>>();
	function logs(name: string) {
		return process(engine, name).responses.filter((response) => response._tag === "Log");
	}
	return {
		beginGetFromServer: (name: string) =>
			Effect.sync(() => {
				tell(`${name} starts an order read over HTTP`);
				pendingReads.set(name, client(engine, name).getResult());
			}),
		blockedReads: () => {
			const sql = engine.sql;
			return eventually(
				sql<{ readonly query: string; readonly "wait_event_type": string }>`select query, wait_event_type from pg_stat_activity
					where datname = current_database() and application_name = ${engine.configuration.applicationName}
					and wait_event_type = 'Lock'`.pipe(
					Effect.filterOrFail(
						(rows) => rows.length > 0,
						() => new Error("No order read is blocked yet"),
					),
				),
			);
		},
		getFromServer: (name: string) => Effect.promise(() => client(engine, name).get()),
		lockOrders: () =>
			Effect.gen(function* () {
				tell("an exclusive PostgreSQL table lock blocks order reads");
				const locked = yield* Deferred.make<void>();
				const sql = engine.sql;
				yield* sql
					.withTransaction(
						Effect.gen(function* () {
							yield* sql`lock table ${sql(engine.configuration.table)} in access exclusive mode`;
							yield* Deferred.succeed(locked, undefined);
							yield* Effect.never;
						}),
					)
					.pipe(Effect.forkScoped);
				yield* Deferred.await(locked);
			}),
		pendingReadResult: (name: string) =>
			Effect.promise(() => {
				const pending = pendingReads.get(name);
				if (pending === undefined) {
					throw new Error(`No read is pending for ${name}`);
				}
				return pending;
			}),
		processLogs: logs,
		terminateBackends: () => {
			tell("PostgreSQL terminates every other backend in the story database");
			const sql = engine.sql;
			return sql<{
				terminated: boolean;
			}>`select pg_terminate_backend(pid) as terminated from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid()`;
		},
		waitForRecovery: () =>
			Effect.promise(() =>
				until(() =>
					["first", "second"].every((name) =>
						logs(name).some(
							(log) => Array.isArray(log.message) && log.message.includes("PostgreSQL change listener recovered; resynchronized live streams"),
						),
					),
				),
			),
		waitForResyncs: () =>
			Effect.promise(() =>
				until(() => [...engine.clients.values()].every((remote) => remote.hints.filter((hint) => hint._tag === "Resync").length > 1)),
			),
	};
}
