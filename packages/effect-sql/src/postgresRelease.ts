import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { SchemaComponent } from "./SchemaComponent.ts";

export const readPostgresRelease = Effect.fn("EffectSql.readPostgresRelease")(function* (table = "effect_sql_migrations") {
	const sql = yield* SqlClient.SqlClient;
	const name = `${table}_release`;
	const identifier = sql`${sql(name)}`.compile()[0];
	const [exists] = yield* sql<{ name: string | null }>`select to_regclass(${identifier})::text as name`.withoutTransform;
	if (exists === undefined || exists.name === null) {
		return undefined;
	}
	const [row] = yield* sql<{ release: string; recordedAt: Date }>`select release, recorded_at as "recordedAt" from ${sql(name)}`.withoutTransform;
	return row;
});

export function postgresRelease(release: string, table = "effect_sql_migrations"): SchemaComponent {
	return {
		apply: Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table if not exists ${sql(`${table}_release`)} (
				id boolean primary key default true check (id),
				release text not null,
				recorded_at timestamptz not null
			)`;
			yield* sql`create table if not exists ${sql(`${table}_workers`)} (
				process_id text primary key,
				release text not null,
				heartbeat timestamptz not null
			)`;
			yield* sql`insert into ${sql(`${table}_release`)} (id, release, recorded_at)
				values (true, ${release}, clock_timestamp())
				on conflict (id) do update set release = excluded.release, recorded_at = excluded.recorded_at`;
		}),
		name: "database release",
		pending: Effect.gen(function* () {
			const current = yield* readPostgresRelease(table);
			return current?.release === release ? undefined : `Expected release ${release}; recorded ${current?.release ?? "none"}`;
		}),
	};
}
