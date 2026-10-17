import { Effect, Layer } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { queryProbes } from "#test/queryProbes.ts";
import { relationProbes } from "#test/relationProbes.ts";
import { runDatabaseTesting } from "#test/runDatabaseTesting.ts";
import { settlementFailures } from "#test/settlementFailures.ts";
import { sqliteOptions } from "#test/sqlite/options.ts";
import { transactionProbes } from "#test/transactionProbes.ts";
import { withTestTransaction } from "#testing/transaction.ts";
import { Database, DatabaseLive } from "./database.ts";

const testing = runDatabaseTesting("src/test-support/sqlite/testing.ts");

export const sqliteStory = storyKit({
	*create() {
		return { db: yield* Database, rollback: false };
	},
	inspect: (engine) => ({ rollback: engine.rollback }),
	layer: DatabaseLive,
	name: "SQLite database",
	runIf: true,
	stages: ["transactions", "rows"],
	verbs: (engine, story) => ({
		db: engine.db,
		escapedValues: () =>
			Effect.gen(function* () {
				const db = yield* Database;
				return { db, stream: db.User.stream };
			}).pipe(Effect.provide(Layer.fresh(DatabaseLive))),
		nestedUser: (email: string) =>
			Effect.gen(function* () {
				const db = yield* Database;
				yield* db.User.create({ email, id: crypto.randomUUID(), name: "Nested" });
				return db;
			}),
		queryProbes: queryProbes(),
		relationProbes: relationProbes(),
		rollback<A, E, R>(program: Effect.Effect<A, E, R> & (Effect.Services<typeof Database> extends R ? unknown : never)) {
			story.tell("the test transaction rolls its writes back");
			return withTestTransaction(Database, program);
		},
		settlementFailures,
		storage: sqliteOptions(),
		testing,
		*transact<A, E, R>(program: Effect.Effect<A, E, R> & (Effect.Services<typeof Database> extends R ? unknown : never)) {
			story.tell(engine.rollback ? "the test transaction rolls its writes back" : "the transaction commits on success");
			return yield* engine.rollback ? withTestTransaction(Database, program) : engine.db.transaction(program);
		},
		transactionProbes: transactionProbes(),
		withFreshDatabase: <A, E, R>(program: Effect.Effect<A, E, R>) => program.pipe(Effect.provide(Layer.fresh(DatabaseLive))),
	}),
});

export function rollbackWrites() {
	return sqliteStory.trait("transactions", "transactions always roll their writes back", (engine) => {
		engine.rollback = true;
	});
}

export function hasUsers(users: Parameters<Effect.Success<typeof Database>["User"]["createAll"]>[0]) {
	return sqliteStory.trait("rows", `the database has ${users.length} users`, function* (engine) {
		yield* engine.db.User.createAll([...users]);
		yield* Effect.addFinalizer(() => Effect.all(users.map((user) => engine.db.User.where({ id: user.id }).deleteAll())).pipe(Effect.orDie));
	});
}
