import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { testUtils } from "better-auth/plugins";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { authDatabase } from "#server/better-auth/mount.ts";
import { signedInUser } from "#server/better-auth/testing.ts";
import { userReference } from "#server/better-auth/userReference.ts";
import { databaseUrl, postgres } from "#test/better-auth/postgres.ts";

export const userReferences = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const database = yield* PostgresTestDatabase;
		const pool = yield* authDatabase(database.url);
		const options = { database: pool, logger: { disabled: true }, secret: "user-reference-story-secret-at-least-32-characters" };
		yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
		return { auth: betterAuth({ ...options, plugins: [testUtils()] }), users: new Map<string, string>() };
	},
	layer: postgres,
	name: "user foreign keys",
	runIf: databaseUrl !== undefined,
	stages: ["rows"],
	verbs: (engine, story) => ({
		deleteUser: (name: string) =>
			Effect.promise(async () => {
				story.tell(`delete ${name}'s auth user`);
				const { internalAdapter } = await engine.auth.$context;
				const id = engine.users.get(name);
				if (id === undefined) {
					throw new Error(`No user exists for ${name}`);
				}
				await internalAdapter.deleteUser(id);
			}),
		storedAppRows: Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			return yield* sql<{ title: string }>`select title from app_notes order by title`;
		}),
		storedUnownedRows: Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			return yield* sql<{ title: string }>`select title from app_notes where user_id is null order by title`;
		}),
	}),
});

export function appRows(onDelete: "cascade" | "set null") {
	return userReferences.trait("rows", `Alice and Bob have app rows referencing users with ON DELETE ${onDelete}`, function* (engine) {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table app_notes (
			title text not null,
			user_id text references ${sql(userReference.table)} (${sql(userReference.column)}) on delete ${sql.literal(onDelete)}
		)`;
		for (const name of ["Alice", "Bob"]) {
			const { user } = yield* Effect.promise(() => signedInUser(engine.auth, { email: `${name}@reference.test`, name }));
			engine.users.set(name, user.id);
			yield* sql`insert into app_notes (title, user_id) values (${name}, ${user.id})`;
		}
	});
}
