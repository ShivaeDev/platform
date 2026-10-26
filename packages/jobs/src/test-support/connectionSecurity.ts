import { Effect } from "effect";
import type { clientEngine } from "#test/clientEngine.ts";
import type { pgBossRuntime } from "#test/pgBossRuntime.ts";

export function connectionSecurity(state: ReturnType<typeof clientEngine>, runtime: ReturnType<typeof pgBossRuntime>) {
	function sql() {
		if (state.sql === undefined) {
			throw new Error("Connection security needs the real PostgreSQL trait");
		}
		return state.sql;
	}
	return {
		connectionBackends: (name: string) => sql()<{ ssl: boolean }>`
			select s.ssl from pg_stat_activity a join pg_stat_ssl s using (pid)
			where a.datname = current_database() and a.application_name = ${name}`,
		connectWithMode: (mode: "require" | undefined, name: string) => {
			const url = new URL(state.connectionString);
			url.searchParams.delete("sslmode");
			url.searchParams.set("application_name", name);
			if (mode !== undefined) {
				url.searchParams.set("sslmode", mode);
			}
			return runtime.boot([], { connectionString: url.toString() });
		},
		serverTls: () => sql()<{ ssl: string }>`show ssl`.pipe(Effect.map(([row]) => row?.ssl === "on")),
	};
}
