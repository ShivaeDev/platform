import { Cause, Effect, Exit, Stream } from "effect";
import { expect } from "vitest";
import { queryGroup, queryUsers } from "#test/queryUsers.ts";
import { Database, uniqueEmail } from "#test/sqlite/database.ts";
import { hasUsers, rollbackWrites, sqliteStory } from "#test/sqlite/story.ts";

const yieldDatabase = Effect.gen(function* () {
	yield* Database;
});

sqliteStory.it("reuses the active transaction for nested boundaries", [], function* ({ db, nestedUser }) {
	const email = uniqueEmail("nested");
	const relation = db.User.where({ email });

	yield* db.transaction(
		Effect.gen(function* () {
			const outer = yield* Database;
			expect(outer).not.toBe(db);
			const inner = yield* db.transaction(nestedUser(email));
			expect(inner).toBe(outer);
		}),
	);

	expect(yield* relation.exists()).toBe(true);
});

sqliteStory.it("serializes concurrent queries inside a transaction", [rollbackWrites()], function* ({ transact }) {
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

sqliteStory.it("buffers transaction streams before downstream database effects", [rollbackWrites(), hasUsers(queryUsers)], function* ({ transact }) {
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
});

sqliteStory.it("refuses a forced rollback boundary inside a commit transaction", [], function* ({ db, rollback }) {
	const error = yield* Effect.flip(
		db.transaction(
			Effect.gen(function* () {
				yield* Database;
				return yield* rollback(yieldDatabase);
			}),
		),
	);

	expect(error.reason).toMatchObject({
		_tag: "PrismaRuntimeFailure",
		code: "RUNTIME.TEST_TRANSACTION_INSIDE_TRANSACTION_UNSUPPORTED",
	});
});

sqliteStory.it("fails closed when a transaction Relation escapes settlement", [], function* ({ db }) {
	const escaped = yield* db.transaction(
		Effect.gen(function* () {
			const transactionDb = yield* Database;
			return {
				db: transactionDb,
				relation: transactionDb.User.where({ id: crypto.randomUUID() }),
				stream: transactionDb.User.stream,
			};
		}),
	);
	const relationError = yield* Effect.flip(escaped.relation.exists());
	const streamError = yield* Effect.flip(Stream.runCollect(escaped.stream));
	const transactionError = yield* Effect.flip(
		escaped.db.transaction(
			Effect.gen(function* () {
				yield* Database;
			}),
		),
	);

	expect(relationError.reason).toMatchObject({
		_tag: "PrismaRuntimeFailure",
		code: "RUNTIME.TRANSACTION_CLOSED",
	});
	expect(streamError.reason).toMatchObject({
		_tag: "PrismaRuntimeFailure",
		code: "RUNTIME.TRANSACTION_CLOSED",
	});
	expect(transactionError.reason).toMatchObject({
		_tag: "PrismaRuntimeFailure",
		code: "RUNTIME.TRANSACTION_CLOSED",
	});
});

sqliteStory.it("refuses an escaped transaction Relation used as an include", [], function* ({ db }) {
	const escapedPost = yield* db.transaction(
		Effect.gen(function* () {
			const transactionDb = yield* Database;
			return transactionDb.Post;
		}),
	);
	const exit = yield* Effect.exit(db.User.include("posts", escapedPost));

	expect(Exit.isFailure(exit)).toBe(true);
	if (Exit.isFailure(exit)) {
		expect(Cause.pretty(exit.cause)).toContain("Included Relation is closed");
	}
});

sqliteStory.it("fails closed when Database values escape their Layer", [], function* ({ escapedValues, withFreshDatabase }) {
	const escaped = yield* escapedValues();
	const streamError = yield* Effect.flip(Stream.runCollect(escaped.stream));
	const transactionError = yield* Effect.flip(
		withFreshDatabase(
			escaped.db.transaction(
				Effect.gen(function* () {
					yield* Database;
				}),
			),
		),
	);

	expect(streamError.reason).toMatchObject({
		_tag: "PrismaRuntimeFailure",
		code: "RUNTIME.DATABASE_CLOSED",
	});
	expect(transactionError.reason).toMatchObject({
		_tag: "PrismaRuntimeFailure",
		code: "RUNTIME.DATABASE_CLOSED",
	});
});
