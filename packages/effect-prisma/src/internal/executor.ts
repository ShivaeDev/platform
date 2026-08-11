import type { Contract as PrismaContract } from "@prisma-next/contract/types";
import type { SqlStorage } from "@prisma-next/sql-contract/types";
import type { ExecutionContext, Runtime } from "@prisma-next/sql-runtime";
import type { Context, Semaphore } from "effect";

export type AnySqlContract = PrismaContract<SqlStorage>;
export type AnyPostgresContract = AnySqlContract;

/**
 * The subset of a Prisma Next client the package depends on. Both the
 * PostgreSQL and the SQLite client satisfy it.
 */
export interface SqlDatabaseClient<Contract extends AnySqlContract> {
	readonly contract: Contract;
	readonly context: ExecutionContext<Contract>;
	runtime(): Runtime;
	close(): Promise<void>;
}

export interface DatabaseExecutor<
	Models extends object,
	Contract extends AnySqlContract = AnySqlContract,
> {
	readonly client: SqlDatabaseClient<Contract>;
	readonly models: Models;
	readonly querySemaphore: Semaphore.Semaphore | undefined;
	readonly transactional: boolean;
}

export type ExecutorService<
	Models extends object,
	Contract extends AnySqlContract = AnySqlContract,
> = Context.Service<
	ExecutorIdentifier<Models>,
	DatabaseExecutor<Models, Contract>
>;

export interface ExecutorIdentifier<Models extends object> {
	readonly _models: Models;
	readonly _executorIdentifier: unique symbol;
}
