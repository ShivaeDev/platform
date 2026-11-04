import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export const foreignAuthSchema = Effect.gen(function* () {
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
	yield* sql`create table "User" (
		id text primary key, name text not null, email text not null unique, "emailVerified" boolean not null,
		image text, "createdAt" timestamptz not null default now(), "updatedAt" timestamptz not null,
		"applicationNote" text
	)`;
	yield* sql`create table "Session" (
		id text primary key, "expiresAt" timestamptz not null, token text not null unique,
		"createdAt" timestamptz not null default now(), "updatedAt" timestamptz not null,
		"ipAddress" text, "userAgent" text, "userId" text not null references "User" (id) on delete cascade
	)`;
	yield* sql`create index "Session_userId_idx" on "Session" ("userId")`;
	yield* sql`create table "Account" (
		id text primary key, "accountId" text not null, "providerId" text not null,
		"userId" text not null references "User" (id) on delete cascade,
		"accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz,
		"refreshTokenExpiresAt" timestamptz, scope text, password text,
		"createdAt" timestamptz not null default now(), "updatedAt" timestamptz not null
	)`;
	yield* sql`create index "Account_userId_idx" on "Account" ("userId")`;
	yield* sql`create table "Verification" (
		id text primary key, identifier text not null, value text not null, "expiresAt" timestamptz not null,
		"createdAt" timestamptz not null default now(), "updatedAt" timestamptz not null default now()
	)`;
	yield* sql`create index "Verification_identifier_idx" on "Verification" (identifier)`;
});

export const removeForeignAuthColumn = Effect.flatMap(SqlClient.SqlClient, (sql) => sql`alter table "User" drop column "emailVerified"`);

export const removeForeignAuthTable = Effect.flatMap(SqlClient.SqlClient, (sql) => sql`drop table "Verification"`);

export const storedForeignSchema = Effect.gen(function* () {
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
	return {
		columns: yield* sql<{ table: string; column: string; type: string; nullable: string; default: string | null }>`
		select table_name as "table", column_name as "column", data_type as type,
		is_nullable as nullable, column_default as "default"
		from information_schema.columns where table_schema = current_schema()
		order by table_name, ordinal_position`,
		constraints: yield* sql<{ table: string; name: string; definition: string }>`
			select t.relname as "table", c.conname as name, pg_get_constraintdef(c.oid) as definition
			from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
			where n.nspname = current_schema() order by t.relname, c.conname`,
		indexes: yield* sql<{ table: string; name: string; definition: string }>`
			select tablename as "table", indexname as name, indexdef as definition from pg_indexes
			where schemaname = current_schema() order by tablename, indexname`,
	};
});
