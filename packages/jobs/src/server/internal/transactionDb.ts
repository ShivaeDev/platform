import { Effect, Option } from "effect";
import { SqlClient } from "effect/sql";
import type { SendOptions } from "pg-boss";

export const transactionDb: Effect.Effect<SendOptions["db"]> = Effect.gen(function* () {
	const sql = yield* Effect.serviceOption(SqlClient.SqlClient);
	if (Option.isNone(sql)) {
		return undefined;
	}
	const transaction = yield* Effect.serviceOption(sql.value.transactionService);
	if (Option.isNone(transaction)) {
		return undefined;
	}
	const [connection] = transaction.value;
	const run = Effect.runPromiseWith(yield* Effect.context<never>());
	return {
		executeSql: async (text, values = []) => ({ rows: Array.from(await run(connection.executeUnprepared(text, values, undefined))) }),
	};
});
