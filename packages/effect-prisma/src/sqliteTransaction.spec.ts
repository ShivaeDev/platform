import { Cause, Effect, Exit, Stream } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { Database, DatabaseLive, uniqueEmail, withDatabase } from "#test/sqlite/database.ts";
import { withTestTransaction } from "#testing/transaction.ts";

function createNested(outer: unknown, email: string) {
	return Effect.gen(function* () {
		const inner = yield* Database;
		expect(inner).toBe(outer);
		yield* inner.User.create({
			email,
			id: crypto.randomUUID(),
			name: "Nested",
		});
	});
}

const yieldDatabase = Effect.gen(function* () {
	yield* Database;
});

it.effect("reuses the active transaction for nested boundaries", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const email = uniqueEmail("nested");
			const relation = db.User.where({ email });

			yield* db.transaction(
				Effect.gen(function* () {
					const outer = yield* Database;
					expect(outer).not.toBe(db);
					yield* db.transaction(createNested(outer, email));
				}),
			);

			expect(yield* relation.exists()).toBe(true);
		}),
	),
);

it.effect("serializes concurrent queries inside a transaction", () =>
	withDatabase(
		withTestTransaction(
			Database,
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
		),
	),
);

it.effect("buffers transaction streams before downstream database effects", () =>
	withDatabase(
		withTestTransaction(
			Database,
			Effect.gen(function* () {
				const db = yield* Database;
				const marker = crypto.randomUUID();
				yield* db.User.createAll(
					["one", "two", "three"].map((suffix) => ({
						email: `${marker}-${suffix}@example.test`,
						id: crypto.randomUUID(),
						name: marker,
					})),
				);

				const exists = yield* Stream.runCollect(
					db.User.where({ name: marker }).stream.pipe(Stream.mapEffect((user) => db.User.where({ id: user.id }).exists())),
				);

				expect(exists).toEqual([true, true, true]);
			}),
		),
	),
);

it.effect("refuses a forced rollback boundary inside a commit transaction", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const error = yield* Effect.flip(
				db.transaction(
					Effect.gen(function* () {
						yield* Database;
						return yield* withTestTransaction(Database, yieldDatabase);
					}),
				),
			);

			expect(error.reason).toMatchObject({
				_tag: "PrismaRuntimeFailure",
				code: "RUNTIME.TEST_TRANSACTION_INSIDE_TRANSACTION_UNSUPPORTED",
			});
		}),
	),
);

it.effect("fails closed when a transaction Relation escapes settlement", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
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
		}),
	),
);

it.effect("refuses an escaped transaction Relation used as an include", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
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
		}),
	),
);

it.effect("fails closed when Database values escape their Layer", function* () {
	const escaped = yield* Effect.gen(function* () {
		const db = yield* Database;
		return { db, stream: db.User.stream };
	}).pipe(Effect.provide(DatabaseLive));
	const streamError = yield* Effect.flip(Stream.runCollect(escaped.stream));
	const transactionError = yield* Effect.flip(
		escaped.db
			.transaction(
				Effect.gen(function* () {
					yield* Database;
				}),
			)
			.pipe(Effect.provide(DatabaseLive)),
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
