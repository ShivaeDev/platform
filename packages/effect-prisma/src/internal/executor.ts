import type { Contract as PrismaContract } from "@prisma-next/contract/types";
import type { SqlStorage } from "@prisma-next/sql-contract/types";
import type { ExecutionContext, Runtime } from "@prisma-next/sql-runtime";
import type { Semaphore } from "effect";

export type AnySqlContract = PrismaContract<SqlStorage>;
export type AnyPostgresContract = AnySqlContract;

export interface SqlDatabaseClient<TContract extends AnySqlContract> {
	close: () => Promise<void>;
	readonly context: ExecutionContext<TContract>;
	readonly contract: TContract;
	runtime: () => Runtime;
}

export interface DatabaseExecutor<TModels extends object, TContract extends AnySqlContract = AnySqlContract> {
	readonly client: SqlDatabaseClient<TContract>;
	readonly identity: object;
	readonly liveness: {
		readonly closedCode: string;
		open: boolean;
	};
	readonly mode: "root" | "test" | "transaction";
	readonly models: TModels;
	readonly querySemaphore: Semaphore.Semaphore | undefined;
	readonly transactionIdentity: object | undefined;
	readonly transactionSemaphore: Semaphore.Semaphore | undefined;
}
