import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { testUtils } from "better-auth/plugins";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { signedInUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { accountExport } from "#server/accountExport.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { betterAuthUserDataExport } from "#server/better-auth/adapters/userDataExport.ts";
import { mappedExportUser, storedExportAccount } from "#server/better-auth/test-support/exportAccounts.ts";
import { userReference } from "#server/better-auth/userReference.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";

function domainExport(table: string) {
	return {
		export: Effect.fnUntraced(function* (userId: string) {
			const sql = yield* SqlClient.SqlClient;
			return yield* sql<{ title: string }>`select title from ${sql(table)} where user_id = ${userId} order by title`;
		}),
		tables: [{ schema: "public", table }],
	};
}

export const dataExports = storyKit({
	around: withIdentityDatabase,
	clock: storyClock,
	*create() {
		const pool = yield* betterAuthDatabase();
		const options = { database: pool, logger: { disabled: true }, secret: "user-export-story-secret-at-least-32-characters" };
		yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
		return {
			auth: betterAuth({ ...options, plugins: [testUtils()] }),
			registry: accountExport({ account: betterAuthUserDataExport(), bookmarks: domainExport("bookmarks"), notes: domainExport("notes") }),
			users: new Map<string, string>(),
		};
	},
	layer: postgres,
	name: "account data exports",
	runIf: databaseUrl !== undefined,
	stages: ["rows", "coverage"],
	verbs: (engine, story) => {
		function exportUser(name: string) {
			story.tell(`export ${name}'s data across the registered domains`);
			const id = engine.users.get(name);
			if (id === undefined) {
				throw new Error(`No user exists for ${name}`);
			}
			return engine.registry.exportUser(id);
		}
		return {
			check: () => {
				story.tell("check every table referencing a user for an export registration");
				return engine.registry.check.pipe(
					Effect.as("registered"),
					Effect.catchTag("UnregisteredUserExportTables", ({ tables }) => Effect.succeed(tables)),
				);
			},
			exportUser,
			requestExport: (name: string) =>
				exportUser(name).pipe(
					Effect.as("exported"),
					Effect.catchTag("UnregisteredUserExportTables", ({ tables }) => Effect.succeed(tables)),
				),
		};
	},
});

export const registeredDomains = dataExports.trait("rows", "alice and bob own notes and bookmarks; some rows have no owner", function* (engine) {
	const sql = yield* SqlClient.SqlClient;
	for (const table of ["notes", "bookmarks"]) {
		yield* sql`create table ${sql(table)} (
			title text not null,
			user_id text references ${sql(userReference.table)} (${sql(userReference.column)}) on delete set null
		)`;
		yield* sql`insert into ${sql(table)} (title) values ('unowned')`;
	}
	for (const name of ["alice", "bob", "charlie"]) {
		const { user } = yield* signedInUser(engine.auth, { email: `${name}@export.test`, name });
		engine.users.set(name, user.id);
		if (name === "charlie") {
			continue;
		}
		for (const table of ["notes", "bookmarks"]) {
			yield* sql`insert into ${sql(table)} (title, user_id) values (${`${name}'s ${table}`}, ${user.id})`;
		}
		yield* storedExportAccount(name, user.id);
	}
});

export const unregisteredTable = dataExports.trait("coverage", "an unregistered table references users twice", function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table forgotten (
		owner_id text references "user" (id) on delete cascade,
		editor_id text references "user" (id) on delete set null
	)`;
});

export const unregisteredSchema = dataExports.trait("coverage", "another schema has an unregistered notes table", function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create schema archive`;
	yield* sql`create table archive.notes (user_id text references "user" (id) on delete cascade)`;
});

export const mappedUserTable = dataExports.trait("coverage", "auth stores users in members instead of user", function* (engine) {
	yield* mappedExportUser;
	engine.registry = accountExport(
		{ account: betterAuthUserDataExport({ user: { modelName: "members" } }), bookmarks: domainExport("bookmarks"), notes: domainExport("notes") },
		{ column: "id", schema: "public", table: "members" },
	);
});
