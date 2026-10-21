import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { fleetRecords } from "#fleetRecords.ts";
import type { FleetHost } from "#host/config.ts";
import type { FleetRecord } from "#model.ts";
import { makeFleetTransaction } from "#storage/makeFleetTransaction.ts";
import { recordInput, recordModel } from "#storage/model.ts";
import { childTable, inputColumns, objectValue, writeChildren } from "#storage/recordChildren.ts";
import { recordShape, type Shape } from "#storage/recordShape.ts";

export function storeState(host: FleetHost, workId: string, payload: Readonly<Record<string, unknown>> & { readonly stage: FleetRecord["stage"] }) {
	return Effect.gen(function* () {
		const transaction = yield* makeFleetTransaction;
		return yield* transaction(
			[fleetRecords.item(workId), fleetRecords.list],
			Effect.gen(function* () {
				const model = recordModel();
				const repository = yield* makeRepository(model, {
					idColumn: "work_id",
					spanPrefix: "Fixture",
					tableName: `${host.namespace}_records`,
					versionColumn: "version",
				});
				const input = yield* Schema.decodeUnknownEffect(model.insert)({
					...recordInput(payload),
					"work_id": workId,
				});
				const previous = yield* repository.findMany({ where: { "work_id": workId } });
				if (previous[0] === undefined) {
					yield* repository.insertVoid(input);
				} else {
					yield* repository.updateVoid({ ...previous[0], ...input });
				}
				yield* writeChildren(host.namespace, workId, payload, recordShape());
			}),
		);
	}).pipe(Effect.orDie);
}

// Status stories start from pre-existing durable state, without replaying each worker's writes.
export const storeRecords = Effect.fn("FleetStory.storeRecords")(function* (host: FleetHost, records: readonly { readonly workId: string }[]) {
	const sql = yield* SqlClient.SqlClient;
	const transaction = yield* makeFleetTransaction;
	const shape = recordShape();
	const tables = new Map<string, Record<string, unknown>[]>();
	const rootTable = `${host.namespace}_records`;
	tables.set(
		rootTable,
		records.map((record) => ({ ...inputColumns(record, shape), version: 0, "work_id": record.workId })),
	);
	function collect(workId: string, value: unknown, node: Shape, path: readonly string[], indices: readonly number[]): void {
		if (value === undefined || typeof node === "string") {
			return;
		}
		if ("fields" in node) {
			const fields = objectValue(value);
			for (const [key, field] of Object.entries(node.fields)) {
				collect(workId, fields[key], field, [...path, key], indices);
			}
		} else if (typeof node.array !== "string" && Array.isArray(value)) {
			const table = childTable(host.namespace, path);
			const rows = tables.get(table) ?? [];
			tables.set(table, rows);
			for (const [index, entry] of value.entries()) {
				const positions = [...indices, index];
				rows.push({
					...inputColumns(entry, node.array),
					...Object.fromEntries(positions.map((position, depth) => [`position${depth}`, position])),
					"work_id": workId,
				});
				collect(workId, entry, node.array, path, positions);
			}
		}
	}
	for (const record of records) {
		collect(record.workId, record, shape, [], []);
	}
	yield* transaction(
		[fleetRecords.list],
		Effect.gen(function* () {
			for (const [table, rows] of tables) {
				const first = rows[0];
				if (first === undefined) {
					continue;
				}
				const columns = sql.csv(Object.keys(first).map((column) => sql`${sql(column)}`));
				yield* sql`insert into ${sql(table)} (${columns}) select ${columns} from json_populate_recordset(null::${sql(table)}, ${JSON.stringify(rows)}::json)`;
			}
		}),
	);
});
