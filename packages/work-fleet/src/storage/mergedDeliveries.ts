import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { addShapeColumns } from "#storage/addShapeColumns.ts";
import { childTable } from "#storage/recordChildren.ts";
import { shapeV17 } from "#storage/shapeV17.ts";

const delivery = { fields: { head: "string", revision: "string", url: "string" } } as const;
const shapeV20 = {
	fields: {
		...shapeV17.fields,
		history: { array: { fields: { ...shapeV17.fields.history.array.fields, mergedDelivery: delivery } } },
		mergedDelivery: delivery,
	},
} as const;

export const mergedDeliveries = Effect.fn("FleetStore.mergedDeliveries")(function* (namespace: string) {
	const sql = yield* SqlClient.SqlClient;
	yield* addShapeColumns(namespace, shapeV17, shapeV20);
	for (const table of [`${namespace}_records`, childTable(namespace, ["history"])]) {
		const rows = yield* sql`
			update ${sql(table)} set "mergedDelivery" = true,
				"mergedDelivery__head" = substring("releaseReason" from '^PR #[0-9]+ merged by a human at ([^;]+); Fleet review covered '),
				"mergedDelivery__url" = "result__pr"
			where stage = 'released' and "result__kind" = 'change' and "result__pr" is not null
				and "releaseReason" ~ '^PR #[0-9]+ merged by a human at [^;]+; Fleet review covered '
			returning work_id`;
		for (const { work_id } of rows) {
			yield* sql`update ${sql(`${namespace}_records`)} set version = version + 1 where work_id = ${work_id}`;
		}
	}
});
