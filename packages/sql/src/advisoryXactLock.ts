import { Data, Effect, Option } from "effect";
import { SqlClient } from "effect/sql";

export class AdvisoryLockOutsideTransaction extends Data.TaggedError("AdvisoryLockOutsideTransaction") {}

export const advisoryXactLock = Effect.fn("EffectSql.advisoryXactLock")(function* (key: bigint | string) {
	const sql = yield* SqlClient.SqlClient;
	const transaction = yield* Effect.serviceOption(sql.transactionService);
	if (Option.isNone(transaction)) {
		return yield* new AdvisoryLockOutsideTransaction();
	}
	if (typeof key === "string") {
		yield* sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
	} else {
		yield* sql`select pg_advisory_xact_lock(${String(key)}::bigint)`;
	}
});
