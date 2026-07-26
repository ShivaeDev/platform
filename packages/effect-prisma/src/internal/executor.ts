import type { Contract as PrismaContract } from "@prisma-next/contract/types";
import type { PostgresClient } from "@prisma-next/postgres/runtime";
import type { SqlStorage } from "@prisma-next/sql-contract/types";
import type { Context } from "effect";

export type AnyPostgresContract = PrismaContract<SqlStorage>;

export interface DatabaseExecutor<
	Models extends object,
	Contract extends AnyPostgresContract = AnyPostgresContract,
> {
	readonly client: PostgresClient<Contract>;
	readonly models: Models;
	readonly transactional: boolean;
}

export type ExecutorService<
	Models extends object,
	Contract extends AnyPostgresContract = AnyPostgresContract,
> = Context.Service<
	ExecutorIdentifier<Models>,
	DatabaseExecutor<Models, Contract>
>;

export interface ExecutorIdentifier<Models extends object> {
	readonly _models: Models;
	readonly _executorIdentifier: unique symbol;
}
