import type { BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { Cause, Effect, Exit, Option, Schema, Scope } from "effect";
import { SqlClient } from "effect/sql";
import { authCallSignal } from "#server/adapters/authCall.ts";
import { betterAuthTransaction } from "./transaction.ts";

type PostgresPool = Extract<NonNullable<BetterAuthOptions["database"]>, { connect: unknown }>;
type PoolClient = Awaited<ReturnType<PostgresPool["connect"]>>;
interface Cursor<R> {
	close: () => Promise<void>;
	read: (count: number) => Promise<R[]>;
}
const Result = Schema.Struct({ command: Schema.String, rowCount: Schema.Number, rows: Schema.Array(Schema.Unknown) });

interface QueryResult<R> {
	command: "UPDATE" | "DELETE" | "INSERT" | "SELECT" | "MERGE";
	rowCount: number;
	rows: R[];
}

function databaseResult<A, E>(exit: Exit.Exit<A, E>): A {
	if (Exit.isSuccess(exit)) {
		return exit.value;
	}
	if (Cause.hasInterruptsOnly(exit.cause)) {
		throw new APIError("REQUEST_TIMEOUT", { code: "REQUEST_CANCELLED", message: "Authentication request was cancelled" });
	}
	throw Cause.squash(exit.cause);
}

export const betterAuthDatabase = Effect.fn("Identity.betterAuthDatabase")(function* () {
	const sql = yield* SqlClient.SqlClient;
	const transaction = yield* Effect.serviceOption(sql.transactionService);
	const parent = yield* Scope.Scope;
	const context = yield* Effect.context<SqlClient.SqlClient>();
	const run = Effect.runPromiseWith(context);
	const runQuery = Effect.runPromiseExitWith(context);
	const pool: PostgresPool = {
		async connect(): Promise<PoolClient> {
			const scope = await run(Scope.fork(parent));
			const connection = await runQuery(
				(Option.isSome(transaction) ? Effect.succeed(transaction.value[0]) : sql.reserve).pipe(
					Scope.provide(scope),
					Effect.onError((cause) => Scope.close(scope, Exit.failCause(cause))),
				),
				{ signal: authCallSignal.getStore() },
			).then(databaseResult);
			const control = Option.isSome(transaction) ? await run(betterAuthTransaction.pipe(Scope.provide(scope))) : undefined;
			function query<R>(text: string, parameters: readonly unknown[]): Promise<QueryResult<R>>;
			function query<R>(cursor: Cursor<R>): Cursor<R>;
			function query(
				text: string | Cursor<unknown>,
				parameters: readonly unknown[] = [],
			): Promise<Schema.Schema.Type<typeof Result>> | Cursor<unknown> {
				if (typeof text !== "string") {
					throw new Error("Better Auth database does not support cursors");
				}
				const nested = control?.(text);
				const signal = text === "begin" || text === "commit" || text === "rollback" ? undefined : authCallSignal.getStore();
				return (
					nested === undefined
						? runQuery(connection.executeRaw(text, parameters), { signal }).then(databaseResult)
						: nested.then(() => ({ command: text, rowCount: 0, rows: [] }))
				).then(Schema.decodeUnknownSync(Result));
			}
			return {
				query,
				release: () => {
					void run(Scope.close(scope, Exit.void));
				},
			};
		},
		// The application SQL Layer owns pool shutdown.
		end: () => Promise.resolve(),
		options: {},
	};
	return pool;
});
