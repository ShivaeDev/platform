import { orm } from "@prisma-next/sql-orm-client";
import { Effect, Exit, Semaphore } from "effect";
import type { PrismaError } from "#error.ts";
import { type SettledConnection, type SettledTransaction, settleConnection } from "#internal/adapters/transaction-settlement.ts";
import type { AnySqlContract, DatabaseExecutor } from "./executor.ts";
import { fromPrismaPromise } from "./promise.ts";

export type TransactionOrm<TContract extends AnySqlContract> = ReturnType<typeof orm<TContract>>;

export const withTransactionSemaphore = <A, E, R>(
	semaphore: Semaphore.Semaphore | undefined,
	transaction: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> => (semaphore === undefined ? transaction : semaphore.withPermit(transaction));

export interface TransactionResource<TModels extends object, TContract extends AnySqlContract> {
	readonly connection: SettledConnection;
	readonly executor: DatabaseExecutor<TModels, TContract> & {
		readonly querySemaphore: Semaphore.Semaphore;
	};
	readonly transaction: SettledTransaction;
}

export const acquireTransaction = <TModels extends object, TContract extends AnySqlContract>(
	current: DatabaseExecutor<TModels, TContract>,
	models: (orm: TransactionOrm<TContract>) => TModels,
	mode: "test" | "transaction",
): Effect.Effect<TransactionResource<TModels, TContract>, PrismaError> =>
	fromPrismaPromise(async () => {
		const connection = await current.client.runtime().connection();

		try {
			const transaction = await connection.transaction();
			const transactionOrm = orm({
				context: current.client.context,
				runtime: transaction,
			});

			return {
				connection,
				executor: {
					client: current.client,
					identity: current.identity,
					liveness: {
						closedCode: "RUNTIME.TRANSACTION_CLOSED",
						open: true,
					},
					mode,
					models: models(transactionOrm),
					querySemaphore: Semaphore.makeUnsafe(1),
					transactionIdentity: {},
					transactionSemaphore: current.transactionSemaphore,
				},
				transaction,
			};
		} catch (error) {
			await connection.destroy(error).catch(() => undefined);
			throw error;
		}
	});

export const releaseTransaction = <TModels extends object, TContract extends AnySqlContract, A, E>(
	resource: TransactionResource<TModels, TContract>,
	exit: Exit.Exit<A, E>,
): Effect.Effect<void, PrismaError> => settleTransaction(resource, exit, true);

export const releaseTestTransaction = <TModels extends object, TContract extends AnySqlContract, A, E>(
	resource: TransactionResource<TModels, TContract>,
	exit: Exit.Exit<A, E>,
): Effect.Effect<void, PrismaError> => settleTransaction(resource, exit, false);

function settleTransaction<TModels extends object, TContract extends AnySqlContract, A, E>(
	resource: TransactionResource<TModels, TContract>,
	exit: Exit.Exit<A, E>,
	commitOnSuccess: boolean,
): Effect.Effect<void, PrismaError> {
	return Effect.uninterruptible(
		Effect.sync(() => {
			resource.executor.liveness.open = false;
		}).pipe(
			Effect.andThen(
				resource.executor.querySemaphore.withPermit(fromPrismaPromise(() => settleConnection(resource, commitOnSuccess && Exit.isSuccess(exit)))),
			),
		),
	);
}
