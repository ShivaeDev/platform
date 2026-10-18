import { Effect, Layer } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { parallelQueries } from "#test/parallelQueries.ts";
import { postgresFailures } from "#test/postgresFailures.ts";
import { postgresPoolLifetime } from "#test/postgresPoolLifetime.ts";
import { clearQueryControls, controlledUsers, queryControl, queryState } from "#test/queryControls.ts";
import { runDatabaseTesting } from "#test/runDatabaseTesting.ts";
import { runDisconnectedBegin } from "#test/runDisconnectedBegin.ts";
import { installRuntimeControls } from "#test/runtimeControls.ts";
import { withTestTransaction } from "#testing/transaction.ts";
import { Database, DatabaseLive, databaseUrl } from "./postgres-database.ts";

const testing = runDatabaseTesting("src/test-support/postgresTesting.ts");

export const postgresStory = storyKit({
	*create() {
		const db = yield* Database;
		return {
			controls: yield* installRuntimeControls(),
			db,
			disconnectBeforeBegin: false,
			query: queryState(),
			rollback: false,
		};
	},
	inspect: (engine) => ({ rollback: engine.rollback }),
	layer: DatabaseLive,
	name: "PostgreSQL database",
	runIf: databaseUrl !== undefined,
	stages: ["transactions", "rows", "controls"],
	verbs: (engine, story) => ({
		db: engine.db,
		disconnectedBegin: () =>
			Effect.promise(() => {
				if (!engine.disconnectBeforeBegin) {
					throw new Error("The story must request a disconnect before BEGIN");
				}
				story.tell("PostgreSQL disconnects before BEGIN reaches the server");
				return runDisconnectedBegin();
			}),
		escapedDatabase: () => Database.pipe(Effect.provide(Layer.fresh(DatabaseLive))),
		failures: postgresFailures(),
		nestedUser: (email: string) =>
			Effect.gen(function* () {
				const db = yield* Database;
				yield* db.User.create({ email, id: crypto.randomUUID(), name: "Nested" });
				return db;
			}),
		parallelQueries: () => {
			if (engine.query.current === undefined) {
				throw new Error("A query coordination trait is required");
			}
			return parallelQueries(
				engine.db.User.where((user) => user.email.in(controlledUsers.map((seed) => seed.email)))
					.orderBy((user) => user.name.asc())
					.select("id"),
				engine.query.current,
			);
		},
		poolLifetime: postgresPoolLifetime,
		rollback<A, E, R>(program: Effect.Effect<A, E, R> & (Effect.Services<typeof Database> extends R ? unknown : never)) {
			story.tell("the test transaction rolls its writes back");
			return withTestTransaction(Database, program);
		},
		testing,
		*transact<A, E, R>(program: Effect.Effect<A, E, R> & (Effect.Services<typeof Database> extends R ? unknown : never)) {
			story.tell(engine.rollback ? "the test transaction rolls its writes back" : "the transaction commits on success");
			return yield* engine.rollback ? withTestTransaction(Database, program) : engine.db.transaction(program);
		},
	}),
});

export function rollbackWrites() {
	return postgresStory.trait("transactions", "transactions always roll their writes back", (engine) => {
		engine.rollback = true;
	});
}

export function hasUsers(users: Parameters<Effect.Success<typeof Database>["User"]["createAll"]>[0]) {
	return postgresStory.trait("rows", `the database has ${users.length} users`, function* (engine) {
		yield* engine.db.User.createAll([...users]);
		yield* Effect.addFinalizer(() => Effect.all(users.map((user) => engine.db.User.where({ id: user.id }).deleteAll())).pipe(Effect.orDie));
	});
}

export function disconnectsBeforeBegin() {
	return postgresStory.trait("transactions", "PostgreSQL disconnects before BEGIN", (engine) => {
		engine.disconnectBeforeBegin = true;
	});
}

export function holdsParallelQueries() {
	return postgresStory.trait("controls", "root queries wait for each other to start", function* (engine) {
		engine.query.current = queryControl(engine.controls, "parallel");
		yield* clearQueryControls(engine.controls);
	});
}
