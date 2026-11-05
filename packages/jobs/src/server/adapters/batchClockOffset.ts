import { Clock, Effect, Schema } from "effect";
import type { PgBossClient } from "#server/client.ts";
import { toPgBossError } from "#server/error.ts";
import { quotedSchema } from "#server/storedRows.ts";

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
	const row = yield* Schema.decodeUnknownEffect(Schema.Struct({ now: Schema.Union([Schema.String, Schema.Number]) }))(rows[0]).pipe(
		Effect.mapError((error) => toPgBossError("settle", error, name)),
	);
	return (yield* Clock.currentTimeMillis) - Number(row.now);
});
