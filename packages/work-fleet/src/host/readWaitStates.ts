import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { State } from "#host/waitOutcome.ts";

export interface ReadOptions {
	readonly namespace: string;
}

export const readWaitStates = Effect.fn("FleetReader.readWaitStates")(function* (options: ReadOptions, ids?: readonly string[]) {
	const read = Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const where = ids === undefined ? sql`true` : sql.in("work_id", ids);
		const rows = yield* sql<{ readonly value: unknown }>`select jsonb_strip_nulls(jsonb_build_object(
			'workId', work_id, 'stage', payload->'stage', 'blocker', payload->'blocker',
			'attentionOwner', payload->'attentionOwner',
			'checks', case when payload->'checks'->'pending' is not null then jsonb_build_object('pending', payload->'checks'->'pending') end,
			'decision', case when payload->'decision'->>'reason' is not null
				then jsonb_strip_nulls(jsonb_build_object('reason', payload->'decision'->'reason', 'code', payload->'decision'->'code', 'attentionOwner', payload->'decision'->'attentionOwner')) end,
			'outcome', jsonb_strip_nulls(jsonb_build_object('url', payload->'outcome'->'url', 'evidence', payload->'outcome'->'evidence'))
		)) as value from ${sql(`${options.namespace}_records`)} where ${where} order by work_id`.pipe(
			Effect.catch((error) => {
				const cause = error.reason.cause;
				return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "42P01" ? Effect.succeed([]) : Effect.fail(error);
			}),
		);
		return yield* Effect.forEach(rows, (row) => Schema.decodeUnknownEffect(State)(row.value));
	});
	return yield* read;
});
