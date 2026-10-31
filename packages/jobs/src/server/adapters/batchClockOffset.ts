import { Clock, Effect } from "effect";
import type { PgBossClient } from "#client.ts";
import { toPgBossError } from "#error.ts";
import { quotedSchema } from "#internal/storedRows.ts";

export const batchClockOffset = Effect.fnUntraced(function* (client: PgBossClient, schema: string, name: string) {
	const { rows } = yield* Effect.tryPromise({
		catch: (error) => toPgBossError("settle", error, name),
		try: () => {
			if (client.getDb === undefined) {
				throw new TypeError("This pg-boss client does not expose its database clock");
			}
			return client.getDb().executeSql(`SELECT EXTRACT(EPOCH FROM ${quotedSchema(schema)}.job_now()) * 1000 AS now`);
		},
	});
	return (yield* Clock.currentTimeMillis) - Number(rows[0].now);
});
