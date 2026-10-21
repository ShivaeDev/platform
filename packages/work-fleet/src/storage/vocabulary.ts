import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { childTable } from "#storage/recordChildren.ts";

export const vocabulary = Effect.fn("FleetStore.vocabulary")(function* (namespace: string) {
	const sql = yield* SqlClient.SqlClient;
	for (const table of [`${namespace}_records`, childTable(namespace, ["history"])]) {
		yield* sql`alter table ${sql(table)} rename column stage to step`;
		yield* sql`alter table ${sql(table)} add column stage text`;
		yield* sql`update ${sql(table)} set step = case step
			when 'prepared' then 'queued' when 'executing' then 'working'
			when 'needs-human' then 'waiting' when 'completed' then 'done' else step end`;
		yield* sql`update ${sql(table)} set stage = case
			when step is null then null
			when step in ('done', 'released') then step
			when step = 'waiting' or blocker is not null or "launchRetry" = true
				or (step = 'validating' and "checks__pending" = true) then 'waiting'
			when step = 'queued' then 'queued'
			when step in ('reviewing', 'validating', 'delivering') then 'reviewing'
			else 'working' end`;
	}
});
