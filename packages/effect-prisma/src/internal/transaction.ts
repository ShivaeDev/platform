import { orm } from "@prisma-next/sql-orm-client";
import { Effect, Exit, Semaphore } from "effect";
import type { PrismaError } from "../error.ts";
import { type SettledConnection, type SettledTransaction, settleConnection } from "./adapters/transaction-settlement.ts";
import type { AnySqlContract, DatabaseExecutor } from "./executor.ts";
import { fromPrismaPromise } from "./promise.ts";

export type TransactionOrm<Contract extends AnySqlContract> = ReturnType<typeof orm<Contract>>;

export const withTransactionSemaphore = <A, E, R>(
	semaphore: Semaphore.Semaphore | undefined,
	transaction: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> => (semaphore === undefined ? transaction : semaphore.withPermit(transaction));

export interface TransactionResource<Models extends object, Contract extends AnySqlContract> {
	readonly connection: SettledConnection;
	readonly executor: DatabaseExecutor<Models, Contract> & {
		readonly querySemaphore: Semaphore.Semaphore;
	};
	readonly transaction: SettledTransaction;
}

export const acquireTransaction = <Models extends object, Contract extends AnySqlContract>(
	current: DatabaseExecutor<Models, Contract>,
	models: (orm: TransactionOrm<Contract>) => Models,
	mode: "test" | "transaction",
): Effect.Effect<TransactionResource<Models, Contract>, PrismaError> =>
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

export const releaseTransaction = <Models extends object, Contract extends AnySqlContract, A, E>(
	resource: TransactionResource<Models, Contract>,
	exit: Exit.Exit<A, E>,
): Effect.Effect<void, PrismaError> => settleTransaction(resource, exit, true);

export const releaseTestTransaction = <Models extends object, Contract extends AnySqlContract, A, E>(
	resource: TransactionResource<Models, Contract>,
	exit: Exit.Exit<A, E>,
): Effect.Effect<void, PrismaError> => settleTransaction(resource, exit, false);

const settleTransaction = <Models extends object, Contract extends AnySqlContract, A, E>(
	resource: TransactionResource<Models, Contract>,
	exit: Exit.Exit<A, E>,
	commitOnSuccess: boolean,
): Effect.Effect<void, PrismaError> =>
	Effect.uninterruptible(
		Effect.sync(() => {
			resource.executor.liveness.open = false;
		}).pipe(
			Effect.andThen(
				resource.executor.querySemaphore.withPermit(fromPrismaPromise(() => settleConnection(resource, commitOnSuccess && Exit.isSuccess(exit)))),
			),
		),
	);
