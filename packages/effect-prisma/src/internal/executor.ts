import type { Contract as PrismaContract } from "@prisma-next/contract/types";
import type { SqlStorage } from "@prisma-next/sql-contract/types";
import type { ExecutionContext, Runtime } from "@prisma-next/sql-runtime";
import type { Semaphore } from "effect";

export type AnySqlContract = PrismaContract<SqlStorage>;
export type AnyPostgresContract = AnySqlContract;

export interface SqlDatabaseClient<Contract extends AnySqlContract> {
	close: () => Promise<void>;
	readonly context: ExecutionContext<Contract>;
	readonly contract: Contract;
	runtime: () => Runtime;
}

export interface DatabaseExecutor<Models extends object, Contract extends AnySqlContract = AnySqlContract> {
	readonly client: SqlDatabaseClient<Contract>;
	readonly identity: object;
	readonly liveness: {
		readonly closedCode: string;
		open: boolean;
	};
	readonly mode: "root" | "test" | "transaction";
	readonly models: Models;
	readonly querySemaphore: Semaphore.Semaphore | undefined;
	readonly transactionIdentity: object | undefined;
	readonly transactionSemaphore: Semaphore.Semaphore | undefined;
}
