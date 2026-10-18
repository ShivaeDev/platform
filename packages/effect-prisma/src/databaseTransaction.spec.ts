import { Cause, Deferred, Effect, Exit, Fiber, Option, Stream } from "effect";
import { expect } from "vitest";
import { Database, scopedValues, uniqueEmail } from "#test/postgresDatabase.ts";
import { hasUsers, postgresStory, rollbackWrites } from "#test/postgresStory.ts";
import { queryGroup, queryUsers } from "#test/queryUsers.ts";

const yieldDatabase = Effect.gen(function* () {
	yield* Database;
});

postgresStory.it("refuses values from a concurrent sibling transaction", [], function* ({ db }) {
	const valuesFromA = yield* Deferred.make<ReturnType<typeof scopedValues>>();
	const releaseA = yield* Deferred.make<void>();
	const transactionA = yield* Effect.forkChild(
		db.transaction(
			Effect.gen(function* () {
				const databaseA = yield* Database;
				yield* Deferred.succeed(valuesFromA, scopedValues(databaseA, uniqueEmail("transaction-a")));
				yield* Deferred.await(releaseA);
			}),
		),
		{ startImmediately: true },
	);
	const fromA = yield* Deferred.await(valuesFromA);
	const rootRelationError = yield* Effect.flip(fromA.relation.exists());
	const rootStreamError = yield* Effect.flip(Stream.runCollect(fromA.stream));
	const rootDatabaseError = yield* Effect.flip(
		fromA.db.transaction(
			Effect.gen(function* () {
				yield* Database;
			}),
		),
	);
	const rootIncludeExit = yield* Effect.exit(db.User.include("posts", fromA.posts));

	const mismatches = yield* db
		.transaction(
			Effect.gen(function* () {
				const databaseB = yield* Database;
				const relationError = yield* Effect.flip(fromA.relation.exists());
				const streamError = yield* Effect.flip(Stream.runCollect(fromA.stream));
				const databaseError = yield* Effect.flip(fromA.db.transaction(yieldDatabase));
				const includeExit = yield* Effect.exit(databaseB.User.include("posts", fromA.posts));
				return { databaseError, includeExit, relationError, streamError };
			}),
		)
		.pipe(Effect.ensuring(Deferred.succeed(releaseA, undefined)));
	yield* Fiber.join(transactionA);

	for (const error of [
		mismatches.databaseError,
		mismatches.relationError,
		mismatches.streamError,
		rootDatabaseError,
		rootRelationError,
		rootStreamError,
	]) {
		expect(error.reason).toMatchObject({
			_tag: "PrismaRuntimeFailure",
			code: "RUNTIME.TRANSACTION_CONTEXT_MISMATCH",
		});
	}
	for (const includeExit of [mismatches.includeExit, rootIncludeExit]) {
		expect(Exit.isFailure(includeExit)).toBe(true);
		if (Exit.isFailure(includeExit)) {
			expect(Cause.pretty(includeExit.cause)).toContain("Included Relation belongs to another transaction");
		}
	}
});

postgresStory.it("serializes concurrent queries inside a transaction", [rollbackWrites()], function* ({ transact }) {
	return yield* transact(
		Effect.gen(function* () {
			const db = yield* Database;
			const marker = crypto.randomUUID();
			const users = ["one", "two", "three"].map((suffix) => ({
				email: `${marker}-${suffix}@example.test`,
				id: crypto.randomUUID(),
				name: marker,
			}));

			yield* Effect.all(
				users.map((user) => db.User.create(user)),
				{ concurrency: "unbounded" },
			);

			expect(yield* db.User.where({ name: marker }).count()).toBe(3);
		}),
	);
});

postgresStory.it(
	"buffers transaction streams before downstream database effects",
	[rollbackWrites(), hasUsers(queryUsers)],
	function* ({ transact }) {
		return yield* transact(
			Effect.gen(function* () {
				const db = yield* Database;
				const marker = queryGroup;

				const exists = yield* Stream.runCollect(
					db.User.where({ name: marker }).stream.pipe(Stream.mapEffect((user) => db.User.where({ id: user.id }).exists())),
				);

				expect(exists).toEqual([true, true, true]);
			}),
		);
	},
);

postgresStory.it("uses the transaction Database and rolls back failures", [], function* ({ db }) {
	const email = uniqueEmail("failure");
	const relation = db.User.where({ email });

	const exit = yield* Effect.exit(
		db.transaction(
			Effect.gen(function* () {
				const transactionDb = yield* Database;
				yield* transactionDb.User.create({
					email,
					id: crypto.randomUUID(),
					name: "Rolled back",
				});
				expect(yield* transactionDb.User.where({ email }).exists()).toBe(true);
				return yield* Effect.fail("expected failure");
			}),
		),
	);

	expect(Exit.isFailure(exit)).toBe(true);
	expect(yield* relation.exists()).toBe(false);
});

postgresStory.it("rolls back interrupted transactions before returning", [], function* ({ db }) {
	const email = uniqueEmail("interruption");
	const created = yield* Deferred.make<void>();
	const relation = db.User.where({ email });

	const fiber = yield* Effect.forkDetach(
		db.transaction(
			Effect.gen(function* () {
				const transactionDb = yield* Database;
				yield* transactionDb.User.create({
					email,
					id: crypto.randomUUID(),
					name: "Interrupted",
				});
				yield* Deferred.succeed(created, undefined);
				return yield* Effect.never;
			}),
		),
		{ startImmediately: true },
	);

	yield* Deferred.await(created);
	yield* Fiber.interrupt(fiber);

	const exists = yield* relation.exists();
	expect(exists).toBe(false);
});

postgresStory.it("forces rollback after a successful test transaction and returns its value", [], function* ({ db, rollback }) {
	const id = crypto.randomUUID();

	const value = yield* rollback(
		Effect.gen(function* () {
			const transactionDb = yield* Database;
			yield* transactionDb.User.create({
				email: `${id}@example.test`,
				id,
				name: "Test transaction",
			});
			return 42;
		}),
	);

	expect(value).toBe(42);
	expect(yield* db.User.where({ id }).exists()).toBe(false);
});

postgresStory.it("preserves a test transaction failure while rolling back its writes", [], function* ({ db, rollback }) {
	const id = crypto.randomUUID();
	const failure = { _tag: "ExpectedFailure" as const };

	const exit = yield* Effect.exit(
		rollback(
			Effect.gen(function* () {
				const transactionDb = yield* Database;
				yield* transactionDb.User.create({
					email: `${id}@example.test`,
					id,
					name: "Failed test transaction",
				});
				return yield* Effect.fail(failure);
			}),
		),
	);

	expect(Exit.isFailure(exit)).toBe(true);
	if (Exit.isFailure(exit)) {
		expect(Option.getOrThrow(Cause.findErrorOption(exit.cause))).toBe(failure);
	}
	expect(yield* db.User.where({ id }).exists()).toBe(false);
});
