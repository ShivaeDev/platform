import { DateTime, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { observeUntil } from "@shivaedev/test-sql/server/observeUntil.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { startHost } from "#test-support/host.ts";
import { configured, postgres } from "#test-support/postgres.ts";

const priorSettings = {
	"idle_in_transaction_session_timeout": "0",
	"jit": "on",
	"max_connections": "60",
	"shared_buffers": "64MB",
};

export const databaseStartup = storyKit({
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	*create() {
		const sql = (yield* SqlClient.SqlClient).withoutTransforms();
		const names = Object.keys(priorSettings);
		const savedSettings = sql<{ name: string; setting: string }>`select distinct on (name) name, setting from pg_file_settings
			where name in ${sql.in(names)} order by name, seqno desc`;
		return {
			liveSettings: sql<{ name: string; setting: string }>`select name, setting from pg_settings
				where name in ('jit', 'idle_in_transaction_session_timeout') order by name`,
			originalSettings: sql<{ name: string; setting: string }>`select name, setting from pg_file_settings
				where name in ${sql.in(names)} and sourcefile like '%/postgresql.auto.conf' order by seqno`,
			savedSettings,
			sql,
			write: (name: string, value: string | undefined) =>
				sql.unsafe(value === undefined ? `ALTER SYSTEM RESET "${name}"` : `ALTER SYSTEM SET "${name}" = '${value.replaceAll("'", "''")}'`).unprepared,
		};
	},
	layer: postgres,
	name: "database startup",
	runIf: configured,
	stages: ["settings"],
	verbs: (engine, story) => ({
		savedPostgresSettings: () => Effect.map(engine.savedSettings, (rows) => Object.fromEntries(rows.map(({ name, setting }) => [name, setting]))),
		start: () => {
			story.tell("the application host starts against PostgreSQL");
			return startHost();
		},
	}),
});

export const differentServerSettings = databaseStartup.trait(
	"settings",
	"PostgreSQL has different server settings before app startup",
	function* (engine) {
		const original = new Map((yield* engine.originalSettings).map(({ name, setting }) => [name, setting]));
		yield* Effect.addFinalizer(() =>
			Effect.gen(function* () {
				for (const name of Object.keys(priorSettings)) {
					yield* engine.write(name, original.get(name));
				}
				yield* engine.sql`select pg_reload_conf()`;
			}).pipe(Effect.orDie),
		);
		for (const [name, value] of Object.entries(priorSettings)) {
			yield* engine.write(name, value);
		}
		yield* engine.sql`select pg_reload_conf()`;
		yield* observeUntil(
			engine.liveSettings,
			(rows) =>
				rows.some(({ name, setting }) => name === "jit" && setting === "on")
				&& rows.some(({ name, setting }) => name === "idle_in_transaction_session_timeout" && setting === "0"),
			"the prior reloadable server settings are live",
		);
	},
);
