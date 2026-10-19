// Register the call-through factory before the typed database module loads.
import "#test/sqlite/initializationFault.ts";
import { Effect, Layer } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { clearQueryControls, queryControl, queryState } from "#test/queryControls.ts";
import { queryProbes } from "#test/queryProbes.ts";
import { relationProbes } from "#test/relationProbes.ts";
import { runDatabaseTesting } from "#test/runDatabaseTesting.ts";
import { installRuntimeControls } from "#test/runtimeControls.ts";
import { settlementFailures } from "#test/settlementFailures.ts";
import { Database, DatabaseLive } from "#test/sqlite/database.ts";
import { failInitialization, initializationFault } from "#test/sqlite/initializationFault.ts";
import { sqliteOptions } from "#test/sqlite/options.ts";
import { transactionProbes } from "#test/transactionProbes.ts";
import { withTestTransaction } from "#testing/transaction.ts";

const testing = runDatabaseTesting("src/test-support/sqlite/testing.ts");

export const sqliteStory = storyKit({
	*create() {
		const db = yield* Database;
		return { controls: yield* installRuntimeControls(), db, initialization: initializationFault(), query: queryState(), rollback: false };
	},
	inspect: (engine) => ({ rollback: engine.rollback }),
	layer: DatabaseLive,
	name: "SQLite database",
	runIf: true,
	stages: ["transactions", "rows", "controls"],
	verbs: (engine, story) => ({
		db: engine.db,
		escapedValues: () =>
			Effect.gen(function* () {
				const db = yield* Database;
				return { db, stream: db.User.stream };
			}).pipe(Effect.provide(Layer.fresh(DatabaseLive))),
		initializationFailure: () =>
			Effect.gen(function* () {
				if (!engine.initialization.enabled) {
					throw new Error("An initialization failure trait is required");
				}
				const usersBeforeFailure = yield* engine.db.User.count();
				story.tell("the typed SQLite Layer initializes a new real client");
				const exit = yield* Effect.exit(Database.pipe(Effect.provide(Layer.fresh(DatabaseLive))));
				return { ...engine.initialization.observe(), exit, usersBeforeFailure };
			}),
		nestedUser: (email: string) =>
			Effect.gen(function* () {
				const db = yield* Database;
				yield* db.User.create({ email, id: crypto.randomUUID(), name: "Nested" });
				return db;
			}),
		queryProbes: queryProbes(engine.db, () => {
			if (engine.query.current === undefined) {
				throw new Error("A query coordination trait is required");
			}
			return engine.query.current;
		}),
		relationProbes: relationProbes(),
		rollback<A, E, R>(program: Effect.Effect<A, E, R> & (Effect.Services<typeof Database> extends R ? unknown : never)) {
			story.tell("the test transaction rolls its writes back");
			return withTestTransaction(Database, program);
		},
		settlementFailures: () => settlementFailures(engine.db, engine.controls),
		storage: sqliteOptions(),
		testing,
		*transact<A, E, R>(program: Effect.Effect<A, E, R> & (Effect.Services<typeof Database> extends R ? unknown : never)) {
			story.tell(engine.rollback ? "the test transaction rolls its writes back" : "the transaction commits on success");
			return yield* engine.rollback ? withTestTransaction(Database, program) : engine.db.transaction(program);
		},
		transactionProbes: transactionProbes(engine.db, engine.controls, () => {
			if (engine.query.current === undefined) {
				throw new Error("A query coordination trait is required");
			}
			return engine.query.current;
		}),
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

export function controlsQueries(mode: Parameters<typeof queryControl>[1]) {
	return sqliteStory.trait("controls", `runtime queries use ${mode} coordination`, function* (engine) {
		engine.query.current = queryControl(engine.controls, mode);
		yield* clearQueryControls(engine.controls);
	});
}
export function failsSettlement(mode: "commit" | "rollback" | "release" | "combined") {
	return sqliteStory.trait("controls", `${mode} settlement fails at the real runtime connection`, (engine) => {
		if (mode === "commit" || mode === "combined") {
			engine.controls.faults.commit = new Error(mode === "combined" ? "COMMIT connection reset" : "commit failed");
		}
		if (mode === "rollback") {
			engine.controls.faults.rollback = new Error("rollback failed");
		}
		if (mode === "release" || mode === "combined") {
			engine.controls.faults.release =
				mode === "combined" ? new Error("connection already terminated") : { code: "RUNTIME.CONNECTION_RELEASE_FAILED" };
		}
	});
}

export function holdsSettlement() {
	return sqliteStory.trait("controls", "settlement waits before reaching the database", function* (engine) {
		engine.controls.beforeSettlement = async () => {
			engine.controls.settlementStarted.resolve();
			await engine.controls.releaseSettlement.promise;
		};
		yield* Effect.addFinalizer(() => Effect.sync(engine.controls.releaseSettlement.resolve));
	});
}

export function failsInitialization() {
	return sqliteStory.trait("controls", "model discovery fails after the real SQLite client connects", (engine) =>
		failInitialization(engine.initialization),
	);
}
