import { it } from "@effect/vitest";
import { Deferred, Effect, Exit, Fiber, Semaphore } from "effect";
import { expect } from "vitest";
import type { AnyPostgresContract } from "../src/internal/executor.js";
import { executeQuery } from "../src/internal/query-execution.js";
import {
	releaseTestTransaction,
	releaseTransaction,
	type TransactionResource,
	withTransactionSemaphore,
} from "../src/internal/transaction.js";

interface ResourceOptions {
	readonly commitFailure?: unknown;
	readonly releaseFailure?: unknown;
	readonly rollbackFailure?: unknown;
}

const makeResource = (options: ResourceOptions = {}) => {
	const calls: Array<string> = [];
	const resource = {
		connection: {
			destroy: async () => {
				calls.push("destroy");
			},
			release: async () => {
				calls.push("release");
				if (options.releaseFailure !== undefined) {
					throw options.releaseFailure;
				}
			},
		},
		executor: {
			client: {},
			identity: {},
			liveness: {
				closedCode: "RUNTIME.TRANSACTION_CLOSED",
				open: true,
			},
			mode: "transaction",
			models: {},
			querySemaphore: Semaphore.makeUnsafe(1),
			transactionIdentity: {},
			transactionSemaphore: undefined,
		},
		transaction: {
			commit: async () => {
				calls.push("commit");
				if (options.commitFailure !== undefined) {
					throw options.commitFailure;
				}
			},
			rollback: async () => {
				calls.push("rollback");
				if (options.rollbackFailure !== undefined) {
					throw options.rollbackFailure;
				}
			},
		},
	} as unknown as TransactionResource<
		Record<string, never>,
		AnyPostgresContract
	>;

	return { calls, resource };
};

it.effect("commits and releases a successful transaction", () =>
	Effect.gen(function* () {
		const { calls, resource } = makeResource();

		yield* releaseTransaction(resource, Exit.succeed(undefined));

		expect(calls).toEqual(["commit", "release"]);
		expect(resource.executor.liveness.open).toBe(false);
	}),
);

it.effect("rolls back and releases a failed transaction", () =>
	Effect.gen(function* () {
		const { calls, resource } = makeResource();

		yield* releaseTransaction(resource, Exit.fail("expected"));

		expect(calls).toEqual(["rollback", "release"]);
		expect(resource.executor.liveness.open).toBe(false);
	}),
);

it.effect("forces rollback for a successful test transaction", () =>
	Effect.gen(function* () {
		const { calls, resource } = makeResource();

		yield* releaseTestTransaction(resource, Exit.succeed(undefined));

		expect(calls).toEqual(["rollback", "release"]);
		expect(resource.executor.liveness.open).toBe(false);
	}),
);

it.effect("reports commit failure after attempting rollback and release", () =>
	Effect.gen(function* () {
		const { calls, resource } = makeResource({
			commitFailure: new Error("commit failed"),
		});

		const error = yield* Effect.flip(
			releaseTransaction(resource, Exit.succeed(undefined)),
		);

		expect(calls).toEqual(["commit", "rollback", "release"]);
		expect(error.reason).toMatchObject({
			_tag: "PrismaRuntimeFailure",
			code: "RUNTIME.TRANSACTION_COMMIT_FAILED",
		});
		expect(resource.executor.liveness.open).toBe(false);
	}),
);

it.effect("destroys the connection when rollback fails", () =>
	Effect.gen(function* () {
		const { calls, resource } = makeResource({
			rollbackFailure: new Error("rollback failed"),
		});

		const error = yield* Effect.flip(
			releaseTransaction(resource, Exit.fail("expected")),
		);

		expect(calls).toEqual(["rollback", "destroy"]);
		expect(error.reason).toMatchObject({
			_tag: "PrismaRuntimeFailure",
			code: "RUNTIME.TRANSACTION_ROLLBACK_FAILED",
		});
		expect(resource.executor.liveness.open).toBe(false);
	}),
);

it.effect("destroys the connection when release fails", () =>
	Effect.gen(function* () {
		const releaseFailure = {
			code: "RUNTIME.CONNECTION_RELEASE_FAILED",
		};
		const { calls, resource } = makeResource({ releaseFailure });

		const error = yield* Effect.flip(
			releaseTransaction(resource, Exit.succeed(undefined)),
		);

		expect(calls).toEqual(["commit", "release", "destroy"]);
		expect(error.reason).toMatchObject({
			_tag: "PrismaRuntimeFailure",
			code: releaseFailure.code,
		});
		expect(resource.executor.liveness.open).toBe(false);
	}),
);

it.effect(
	"drains the active query and refuses queued work before settlement",
	() =>
		Effect.gen(function* () {
			const { calls, resource } = makeResource();
			const queryStarted = yield* Deferred.make<void>();
			const releaseQuery = yield* Deferred.make<void>();
			const active = yield* Effect.forkChild(
				executeQuery(
					resource.executor,
					Effect.gen(function* () {
						calls.push("query1");
						yield* Deferred.succeed(queryStarted, undefined);
						yield* Deferred.await(releaseQuery);
					}),
				),
				{ startImmediately: true },
			);
			yield* Deferred.await(queryStarted);
			const queued = yield* Effect.forkChild(
				executeQuery(
					resource.executor,
					Effect.sync(() => calls.push("query2")),
				).pipe(
					Effect.tapError((error) =>
						Effect.sync(() => {
							if (error.reason._tag === "PrismaRuntimeFailure") {
								calls.push(`queued:${error.reason.code}`);
							}
						}),
					),
				),
				{ startImmediately: true },
			);
			const settlement = yield* Effect.forkChild(
				releaseTransaction(resource, Exit.succeed(undefined)),
				{ startImmediately: true },
			);

			yield* Effect.yieldNow;
			expect(calls).toEqual(["query1"]);
			yield* Deferred.succeed(releaseQuery, undefined);
			yield* Fiber.join(active);
			const queuedError = yield* Effect.flip(Fiber.join(queued));
			yield* Fiber.join(settlement);

			expect(queuedError.reason).toMatchObject({
				_tag: "PrismaRuntimeFailure",
				code: "RUNTIME.TRANSACTION_CLOSED",
			});
			expect(calls).toEqual([
				"query1",
				"queued:RUNTIME.TRANSACTION_CLOSED",
				"commit",
				"release",
			]);
		}),
);

it.effect("holds the transaction permit through interrupted settlement", () =>
	Effect.gen(function* () {
		const semaphore = Semaphore.makeUnsafe(1);
		const firstEntered = yield* Deferred.make<void>();
		const settlementStarted = yield* Deferred.make<void>();
		const releaseSettlement = yield* Deferred.make<void>();
		const secondEntered = yield* Deferred.make<void>();
		const firstScope = Effect.acquireUseRelease(
			Effect.void,
			() =>
				Effect.gen(function* () {
					yield* Deferred.succeed(firstEntered, undefined);
					yield* Effect.never;
				}),
			() =>
				Effect.gen(function* () {
					yield* Deferred.succeed(settlementStarted, undefined);
					yield* Deferred.await(releaseSettlement);
				}),
		);
		const first = yield* Effect.forkChild(
			withTransactionSemaphore(semaphore, firstScope),
			{ startImmediately: true },
		);
		yield* Deferred.await(firstEntered);
		const second = yield* Effect.forkChild(
			withTransactionSemaphore(
				semaphore,
				Deferred.succeed(secondEntered, undefined),
			),
			{ startImmediately: true },
		);
		yield* Effect.yieldNow;
		expect(yield* Deferred.isDone(secondEntered)).toBe(false);
		const interruption = yield* Effect.forkChild(Fiber.interrupt(first), {
			startImmediately: true,
		});
		yield* Deferred.await(settlementStarted);
		expect(yield* Deferred.isDone(secondEntered)).toBe(false);

		yield* Deferred.succeed(releaseSettlement, undefined);
		yield* Fiber.join(interruption);
		yield* Fiber.join(second);
		expect(yield* Deferred.isDone(secondEntered)).toBe(true);
	}),
);
