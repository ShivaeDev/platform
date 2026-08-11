import { orm } from "@prisma-next/sql-orm-client";
import type {
	RuntimeConnection,
	RuntimeTransaction,
} from "@prisma-next/sql-runtime";
import { Effect, Exit, Semaphore } from "effect";
import type { PrismaError } from "../error.js";
import type { AnySqlContract, DatabaseExecutor } from "./executor.js";
import { fromPrismaPromise } from "./promise.js";

export type TransactionOrm<Contract extends AnySqlContract> = ReturnType<
	typeof orm<Contract>
>;

export interface TransactionResource<
	Models extends object,
	Contract extends AnySqlContract,
> {
	readonly connection: RuntimeConnection;
	readonly transaction: RuntimeTransaction;
	readonly executor: DatabaseExecutor<Models, Contract>;
}

const runtimeFailure = (
	code: string,
	cause: unknown,
	details?: Readonly<Record<string, unknown>>,
): Error & { readonly code: string } =>
	Object.assign(new Error(code, { cause }), { code, ...details });

export const acquireTransaction = <
	Models extends object,
	Contract extends AnySqlContract,
>(
	current: DatabaseExecutor<Models, Contract>,
	models: (orm: TransactionOrm<Contract>) => Models,
): Effect.Effect<TransactionResource<Models, Contract>, PrismaError> =>
	fromPrismaPromise(async () => {
		const connection = await current.client.runtime().connection();

		try {
			const transaction = await connection.transaction();
			const transactionOrm = orm({
				runtime: transaction,
				context: current.client.context,
			});

			return {
				connection,
				transaction,
				executor: {
					client: current.client,
					models: models(transactionOrm),
					querySemaphore: Semaphore.makeUnsafe(1),
					transactional: true,
				},
			};
		} catch (error) {
			await connection.destroy(error).catch(() => undefined);
			throw error;
		}
	});

export const releaseTransaction = <
	Models extends object,
	Contract extends AnySqlContract,
	A,
	E,
>(
	resource: TransactionResource<Models, Contract>,
	exit: Exit.Exit<A, E>,
): Effect.Effect<void, PrismaError> => settleTransaction(resource, exit, true);

export const releaseTestTransaction = <
	Models extends object,
	Contract extends AnySqlContract,
	A,
	E,
>(
	resource: TransactionResource<Models, Contract>,
	exit: Exit.Exit<A, E>,
): Effect.Effect<void, PrismaError> => settleTransaction(resource, exit, false);

const settleTransaction = <
	Models extends object,
	Contract extends AnySqlContract,
	A,
	E,
>(
	resource: TransactionResource<Models, Contract>,
	exit: Exit.Exit<A, E>,
	commitOnSuccess: boolean,
): Effect.Effect<void, PrismaError> =>
	Effect.uninterruptible(
		fromPrismaPromise(async () => {
			let disposed = false;
			let failure: unknown;

			const destroy = async (reason: unknown): Promise<void> => {
				if (disposed) {
					return;
				}
				disposed = true;
				await resource.connection.destroy(reason).catch(() => undefined);
			};

			if (commitOnSuccess && Exit.isSuccess(exit)) {
				try {
					await resource.transaction.commit();
				} catch (commitError) {
					try {
						await resource.transaction.rollback();
					} catch {
						await destroy(commitError);
					}
					failure = runtimeFailure(
						"RUNTIME.TRANSACTION_COMMIT_FAILED",
						commitError,
					);
				}
			} else {
				try {
					await resource.transaction.rollback();
				} catch (rollbackError) {
					await destroy(rollbackError);
					failure = runtimeFailure(
						"RUNTIME.TRANSACTION_ROLLBACK_FAILED",
						rollbackError,
					);
				}
			}

			if (!disposed) {
				try {
					await resource.connection.release();
				} catch (releaseError) {
					await destroy(releaseError);
					if (failure !== undefined) {
						throw runtimeFailure(
							"RUNTIME.TRANSACTION_RELEASE_FAILED",
							failure,
							{ releaseError },
						);
					}
					throw releaseError;
				}
			}

			if (failure !== undefined) {
				throw failure;
			}
		}),
	);
