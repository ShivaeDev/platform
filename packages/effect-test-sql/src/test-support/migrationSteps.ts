import { Effect } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { makePostgresTestLayer } from "#postgres.ts";
import { adminUrl } from "#test/postgres.ts";

export const migrations = {
	loader: Migrator.fromRecord({
		"001_create_contacts": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table contacts (id integer primary key, email text not null)`;
		}),
		"002_backfill_emails": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table emails (contact_id integer primary key references contacts(id), address text not null)`;
			yield* sql`insert into emails (contact_id, address) select id, email from contacts`;
		}),
		"003_drop_email": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`alter table contacts drop column email`;
		}),
	}),
	lockTimeout: "5 seconds" as const,
	table: "BackfillMigrations",
};

export const layer = makePostgresTestLayer({ migrations, prepare: false, url: adminUrl });

export const seedContacts = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`insert into contacts (id, email) values (1, 'alice@example.test'), (2, 'bob@example.test')`;
});

export const emails = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	return yield* sql`select contact_id, address from emails order by contact_id`;
});
