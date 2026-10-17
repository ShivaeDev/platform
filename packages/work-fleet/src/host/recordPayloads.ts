import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { recordModel } from "#storage/model.ts";
import { readRecords } from "#storage/readRecords.ts";
import { recordShape } from "#storage/recordShape.ts";
import { recordValues } from "#storage/recordValue.ts";

export const recordPayloads = Effect.fn("FleetHost.recordPayloads")(function* (namespace: string, workId?: string) {
	const sql = yield* SqlClient.SqlClient;
	const table = `${namespace}_records`;
	const [present] = yield* sql<{ readonly present: boolean }>`select to_regclass(${table}) is not null as present`;
	if (present?.present !== true) {
		return [];
	}
	const repository = yield* makeRepository(recordModel(), { idColumn: "work_id", spanPrefix: "FleetReader", tableName: table });
	return yield* readRecords(
		namespace,
		Effect.gen(function* () {
			const rows = yield* repository.findMany({ orderBy: { direction: "asc", field: "work_id" }, where: { "work_id": workId } });
			return (yield* recordValues(rows, recordShape(), namespace)).map((value) => JSON.stringify(value));
		}),
	);
});
