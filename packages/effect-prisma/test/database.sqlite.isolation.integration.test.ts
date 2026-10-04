import { it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Option } from "effect";
import { expect } from "vitest";
import { Database, uniqueEmail, withDatabase } from "#test/sqlite/database.ts";
import { withTestTransaction } from "#testing.ts";

it.effect("serializes SQLite transaction scopes for one Database Layer", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const firstEntered = yield* Deferred.make<void>();
			const releaseFirst = yield* Deferred.make<void>();
			const secondEntered = yield* Deferred.make<void>();
			const first = yield* Effect.forkChild(
				db.transaction(
					Effect.gen(function* () {
						yield* Database;
						yield* Deferred.succeed(firstEntered, undefined);
						yield* Deferred.await(releaseFirst);
					}),
				),
				{ startImmediately: true },
			);
			yield* Deferred.await(firstEntered);
			const second = yield* Effect.forkChild(
				db.transaction(
					Effect.gen(function* () {
						yield* Database;
						yield* Deferred.succeed(secondEntered, undefined);
					}),
				),
				{ startImmediately: true },
			);

			yield* Effect.yieldNow;
			expect(yield* Deferred.isDone(secondEntered)).toBe(false);
			yield* Deferred.succeed(releaseFirst, undefined);
			yield* Fiber.join(first);
			yield* Fiber.join(second);
			expect(yield* Deferred.isDone(secondEntered)).toBe(true);
		}),
	),
);

it.effect("excludes root queries for the lifetime of a SQLite transaction", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const transactionRead = yield* Deferred.make<void>();
			const continueTransaction = yield* Deferred.make<void>();
			const rootWriteStarted = yield* Deferred.make<void>();
			const rootWriteFinished = yield* Deferred.make<void>();
			const transactionEmail = uniqueEmail("transaction-snapshot");
			const rootEmail = uniqueEmail("root-snapshot");

			const transaction = yield* Effect.forkChild(
				db.transaction(
					Effect.gen(function* () {
						const transactionDb = yield* Database;
						yield* transactionDb.User.count();
						yield* Deferred.succeed(transactionRead, undefined);
						yield* Deferred.await(continueTransaction);
						yield* transactionDb.User.create({
							email: transactionEmail,
							id: crypto.randomUUID(),
							name: "Transaction snapshot",
						});
					}),
				),
				{ startImmediately: true },
			);
			yield* Deferred.await(transactionRead);

			const rootWrite = yield* Effect.forkChild(
				Deferred.succeed(rootWriteStarted, undefined).pipe(
					Effect.andThen(
						db.User.create({
							email: rootEmail,
							id: crypto.randomUUID(),
							name: "Root snapshot",
						}),
					),
					Effect.andThen(Deferred.succeed(rootWriteFinished, undefined)),
				),
				{ startImmediately: true },
			);

			yield* Deferred.await(rootWriteStarted);
			yield* Effect.yieldNow;
			const rootWasBlocked = !(yield* Deferred.isDone(rootWriteFinished));
			yield* Deferred.succeed(continueTransaction, undefined);
			yield* Fiber.join(transaction);
			yield* Fiber.join(rootWrite);

			expect(rootWasBlocked).toBe(true);
			expect(yield* db.User.where({ email: transactionEmail }).exists()).toBe(true);
			expect(yield* db.User.where({ email: rootEmail }).exists()).toBe(true);
		}),
	),
);

it.effect("settles an interrupted SQLite transaction before admitting the next", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const firstEntered = yield* Deferred.make<void>();
			const secondEntered = yield* Deferred.make<void>();
			const first = yield* Effect.forkChild(
				db.transaction(
					Effect.gen(function* () {
						yield* Database;
						yield* Deferred.succeed(firstEntered, undefined);
						yield* Effect.never;
					}),
				),
				{ startImmediately: true },
			);
			yield* Deferred.await(firstEntered);
			const second = yield* Effect.forkChild(
				db.transaction(
					Effect.gen(function* () {
						yield* Database;
						yield* Deferred.succeed(secondEntered, undefined);
					}),
				),
				{ startImmediately: true },
			);

			yield* Effect.yieldNow;
			expect(yield* Deferred.isDone(secondEntered)).toBe(false);
			yield* Fiber.interrupt(first);
			yield* Fiber.join(second);
			expect(yield* Deferred.isDone(secondEntered)).toBe(true);
		}),
	),
);

it.effect("uses the transaction Database and rolls back failures", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
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
		}),
	),
);

it.effect("rolls back interrupted transactions before returning", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
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

			expect(yield* relation.exists()).toBe(false);
		}),
	),
);

it.effect("forces rollback after a successful test transaction and returns its value", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const id = crypto.randomUUID();

			const value = yield* withTestTransaction(
				Database,
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
		}),
	),
);

it.effect("preserves a test transaction failure while rolling back its writes", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const id = crypto.randomUUID();
			const failure = { _tag: "ExpectedFailure" as const };

			const exit = yield* Effect.exit(
				withTestTransaction(
					Database,
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
		}),
	),
);
