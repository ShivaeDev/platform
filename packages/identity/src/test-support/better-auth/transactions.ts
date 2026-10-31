import { getAdapter } from "better-auth/db/adapter";
import { getMigrations } from "better-auth/db/migration";
import { Data, Effect, Redacted } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { databaseUrl } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";

class Cancelled extends Data.TaggedError("Cancelled")<{ readonly createdName: string }> {}
const options = { secret: "shared-transaction-story-secret-at-least-32-characters" };
const postgres = makePostgresTestLayer({
	maxConnections: 1,
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled"),
});

const createAuthUser = Effect.fn("AuthTransactionStory.createAuthUser")(function* (outcome: "commit" | "rollback" | "auth rollback") {
	const database = yield* betterAuthDatabase();
	const adapter = yield* Effect.promise(() => getAdapter({ ...options, database }));
	const createdName = yield* Effect.tryPromise(() =>
		adapter.transaction(async (transaction) => {
			const data = { createdAt: new Date(0), email: "alice@transaction.test", emailVerified: false, name: "alice", updatedAt: new Date(0) };
			const created = await transaction.create<typeof data>({ data, model: "user" });
			if (outcome === "auth rollback") {
				throw new Cancelled({ createdName: created.name });
			}
			return created.name;
		}),
	).pipe(Effect.catch((error) => (error.cause instanceof Cancelled ? Effect.succeed(error.cause.createdName) : Effect.fail(error))));
	return createdName;
});

export const authTransactions = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const database = yield* betterAuthDatabase();
		yield* Effect.promise(async () => (await getMigrations({ ...options, database })).runMigrations());
		return { sql: yield* SqlClient.SqlClient };
	},
	layer: postgres,
	name: "auth on the application transaction",
	runIf: databaseUrl !== undefined,
	stages: [],
	verbs: ({ sql }, story) => ({
		createUser: (outcome: "commit" | "rollback" | "auth rollback") =>
			sql
				.withTransaction(
					Effect.gen(function* () {
						story.tell(`the app creates alice through Better Auth then ${outcome}s its transaction`);
						const createdName = yield* createAuthUser(outcome);
						yield* sql`select 1`;
						if (outcome === "rollback") {
							return yield* Effect.fail(new Cancelled({ createdName }));
						}
						return createdName;
					}),
				)
				.pipe(Effect.catchTag("Cancelled", (error) => Effect.succeed(error.createdName))),
		storedUsers: () =>
			Effect.flatMap(authTestDatabase, (storage) => storage.users).pipe(
				Effect.map((rows) => rows.map(({ email }) => email.slice(0, email.indexOf("@")))),
			),
	}),
});
