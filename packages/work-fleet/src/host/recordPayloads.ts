import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

export const recordPayloads = Effect.fn("FleetHost.recordPayloads")(function* (namespace: string, workId?: string) {
	const sql = yield* SqlClient.SqlClient;
	const table = `${namespace}_records`;
	const [present] = yield* sql<{ readonly present: boolean }>`select to_regclass(${table}) is not null as present`;
	if (present?.present !== true) {
		return [];
	}
	const rows =
		workId === undefined
			? yield* sql<{ readonly value: string }>`select payload::text as value from ${sql(table)} order by work_id`
			: yield* sql<{ readonly value: string }>`select payload::text as value from ${sql(table)} where work_id = ${workId}`;
	return rows.map((row) => row.value);
});
