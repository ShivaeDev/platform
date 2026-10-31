import { Effect, Redacted, Schema } from "effect";
import type { Registration } from "#test/workers.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";
import { runningIn, startRuntime } from "./engine.ts";

const Backend = Schema.Tuple([Schema.Struct({ pid: Schema.Number })]);

function backendOf(engine: DatabaseEngine, name: string) {
	return Effect.promise(async () => {
		const db = runningIn(engine, name).client.getDb?.();
		if (db === undefined) {
			throw new Error(`${name}'s client exposes no database`);
		}
		const { rows } = await db.executeSql("select pg_backend_pid() as pid");
		return Schema.decodeUnknownSync(Backend)(rows)[0].pid;
	});
}

export function connectionVerbs(engine: DatabaseEngine, tell: (line: string) => void) {
	const terminated = new Set<number>();
	return {
		connectionAfterwards: (name: string) =>
			Effect.map(backendOf(engine, name), (pid) => (terminated.has(pid) ? "the terminated connection" : "a new connection")),
		connectionsOf: (applicationName: string) =>
			engine.sql<{ readonly ssl: boolean }>`select s.ssl from pg_stat_activity a join pg_stat_ssl s using (pid)
				where a.datname = current_database() and a.application_name = ${applicationName}`.pipe(
				Effect.map((rows) => {
					if (rows.length === 0) {
						return "none";
					}
					if (rows.every(({ ssl }) => ssl)) {
						return "all with TLS";
					}
					return rows.every(({ ssl }) => !ssl) ? "all without TLS" : "mixed";
				}),
			),
		startWithSslMode: (name: string, jobs: readonly Registration[], mode: "require" | undefined) => {
			tell(`${name} starts the jobs runtime with sslmode ${mode ?? "unset"}`);
			const url = new URL(Redacted.value(engine.url));
			url.searchParams.delete("sslmode");
			url.searchParams.set("application_name", name);
			if (mode !== undefined) {
				url.searchParams.set("sslmode", mode);
			}
			return startRuntime(engine, name, jobs, { connectionString: Redacted.make(url.toString()) });
		},
		terminateIdleConnections: (name: string) => {
			tell(`an administrator terminates ${name}'s idle PostgreSQL connections`);
			return Effect.gen(function* () {
				terminated.add(yield* backendOf(engine, name));
				yield* engine.sql`select pg_terminate_backend(pid) from pg_stat_activity
					where datname = current_database() and application_name = ${name} and state = 'idle'`;
			});
		},
	};
}

export const serverTlsAbsent = Effect.fnUntraced(function* (engine: DatabaseEngine) {
	const [setting] = yield* engine.sql<{ readonly ssl: string }>`show ssl`;
	if (setting?.ssl === "on") {
		return yield* Effect.die(new Error("These stories expect the shared test PostgreSQL to serve no TLS"));
	}
});
