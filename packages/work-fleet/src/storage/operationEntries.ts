import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { childTable } from "#storage/recordChildren.ts";

export const operationEntries = Effect.fn("FleetRow.operationEntries")(function* (namespace: string, operationId: string) {
	const sql = yield* SqlClient.SqlClient;
	return yield* sql<{ readonly workId: string; readonly version: number }>`
		select records.work_id as "workId", records.version + 1 as version
		from ${sql(`${namespace}_records`)} records join (
			select work_id from ${sql(childTable(namespace, ["attempts"]))} where ${sql("operationId")} = ${operationId}
			union all
			select work_id from ${sql(childTable(namespace, ["history", "attempts"]))} where ${sql("operationId")} = ${operationId}
		) attempts on attempts.work_id = records.work_id`;
});
