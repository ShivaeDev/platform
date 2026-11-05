import { Effect, Option } from "effect";
import { transactionDb } from "#server/adapters/transactionDb.ts";
import type { EnqueueOptions } from "#server/enqueueOptions.ts";
import { toPgBossError } from "#server/error.ts";
import { PgBoss } from "#server/PgBoss.ts";
export const enqueue = Effect.fn("PgBossOperations.enqueue")(function* (name: string, data: object, options?: EnqueueOptions) {
	const { client } = yield* PgBoss;
	const db = yield* transactionDb;
	const sendOptions = db === undefined ? options : { ...options, db };
	const send = Effect.tryPromise({ catch: (error) => toPgBossError("enqueue", error, name), try: () => client.send(name, data, sendOptions) });
	return Option.fromNullishOr(yield* db === undefined ? send : Effect.uninterruptible(send));
});
