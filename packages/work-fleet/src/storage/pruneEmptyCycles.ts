import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export const pruneEmptyCycles = Effect.fn("FleetStore.pruneEmptyCycles")(function* (namespace: string) {
	const sql = yield* SqlClient.SqlClient;
	return yield* sql`with pruned as (
		select work_id, coalesce(jsonb_agg(cycle order by position) filter (
			where jsonb_array_length(cycle->'attempts') > 0
				or coalesce(cycle->'decision', 'null'::jsonb) <> 'null'::jsonb
				or jsonb_array_length(coalesce(cycle->'responses', '[]'::jsonb)) > 0
		), '[]'::jsonb)::text as history
		from ${sql(`${namespace}_records`)}, jsonb_array_elements(history::jsonb) with ordinality as cycles(cycle, position)
		group by work_id
		having bool_or(jsonb_array_length(cycle->'attempts') = 0
			and coalesce(cycle->'decision', 'null'::jsonb) = 'null'::jsonb
			and coalesce(jsonb_array_length(cycle->'responses'), 0) = 0)
	)
	update ${sql(`${namespace}_records`)} as records set history = pruned.history, version = records.version + 1
	from pruned where records.work_id = pruned.work_id`;
});
