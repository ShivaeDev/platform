import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export const authMigrationSchema = Effect.gen(function* () {
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
	return {
		columns: yield* sql<{ table: string; column: string; type: string; nullable: string; default: string | null }>`
			select table_name as "table", column_name as "column", data_type as type, is_nullable as nullable, column_default as "default"
			from information_schema.columns where table_schema = current_schema() and table_name in ('user', 'session', 'account', 'verification')
			order by table_name, ordinal_position`,
		constraints: yield* sql<{ table: string; name: string; definition: string }>`
			select t.relname as "table", c.conname as name, pg_get_constraintdef(c.oid) as definition
			from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
			where n.nspname = current_schema() and t.relname in ('user', 'session', 'account', 'verification') order by t.relname, c.conname`,
		indexes: yield* sql<{ table: string; name: string; definition: string }>`
			select tablename as "table", indexname as name, indexdef as definition from pg_indexes
			where schemaname = current_schema() and tablename in ('user', 'session', 'account', 'verification') order by tablename, indexname`,
	};
});
