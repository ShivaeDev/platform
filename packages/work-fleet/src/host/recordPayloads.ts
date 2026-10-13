import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { recordColumns, recordJson, recordModel } from "#storage/model.ts";

export const recordPayloads = Effect.fn("FleetHost.recordPayloads")(function* (namespace: string, workId?: string) {
	const sql = yield* SqlClient.SqlClient;
	const table = `${namespace}_records`;
	const [present] = yield* sql<{ readonly present: boolean }>`select to_regclass(${table}) is not null as present`;
	if (present?.present !== true) {
		return [];
	}
	const repository = yield* makeRepository(recordModel(), { idColumn: "work_id", spanPrefix: "FleetReader", tableName: table });
	const rows = yield* repository.findMany({ orderBy: { direction: "asc", field: "work_id" }, where: { "work_id": workId } });
	return yield* Effect.forEach(rows, (row) => recordJson(row, recordColumns()));
});
