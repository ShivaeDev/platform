import { Effect } from "effect";
import { client, type ProcessEngine, process } from "./processEngine.ts";
import { until } from "./processHarness.ts";

export function failoverVerbs(engine: ProcessEngine) {
	function logs(name: string) {
		return process(engine, name).responses.filter((response) => response._tag === "Log");
	}
	return {
		getFromServer: (name: string) => Effect.promise(() => client(engine, name).get()),
		processLogs: logs,
		terminateBackends: () => {
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
