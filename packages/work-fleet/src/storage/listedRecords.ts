import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { recordModel, Versioned } from "#storage/model.ts";
import type { Shape } from "#storage/recordShape.ts";
import { recordValues } from "#storage/recordValue.ts";

// Admission reads the whole list once per waiting item, so unchanged rows reuse their decoded value; xmin tells a committed row apart from a rolled-back write of the same version.
export function listedRecords<TSchema extends Schema.Top & { readonly DecodingServices: never; readonly EncodingServices: never }>(
	sql: SqlClient.SqlClient,
	schema: TSchema,
	model: ReturnType<typeof recordModel>,
	shape: Shape,
	namespace: string,
) {
	const table = `${namespace}_records`;
	const decodeRows = Schema.decodeUnknownEffect(Schema.Array(Schema.Struct(model.fields)));
	const decodeRecords = Schema.decodeUnknownEffect(Schema.Array(schema));
	const listed = new Map<string, { readonly revision: string; readonly stored: Versioned<TSchema["Type"]> }>();
	const refreshListed = Effect.fn("FleetStore.refreshListed")(function* (workIds: readonly string[]) {
		const raw = yield* sql<{
			readonly revision: string;
		}>`select *, "version"::text || ':' || xmin::text as revision from ${sql(table)} where ${sql.in("work_id", workIds)}`;
		const found = yield* decodeRows(raw);
		const values = yield* decodeRecords(yield* recordValues(found, shape, namespace).pipe(Effect.provideService(SqlClient.SqlClient, sql)));
		for (const [index, row] of found.entries()) {
			const value = values[index];
			const revision = raw[index]?.revision;
			if (value !== undefined && revision !== undefined) {
				listed.set(row.work_id, { revision, stored: { value, version: row.version + 1 } });
			}
		}
	});
	return Effect.fn("FleetStore.readList")(function* () {
		const heads = yield* sql<{
			readonly "work_id": string;
			readonly revision: string;
		}>`select "work_id", "version"::text || ':' || xmin::text as revision from ${sql(table)} order by "admission_order" asc`;
		const changed = heads.filter((head) => listed.get(head.work_id)?.revision !== head.revision).map((head) => head.work_id);
		if (changed.length > 0) {
			yield* refreshListed(changed);
		}
		const present = new Set(heads.map((head) => head.work_id));
		for (const workId of listed.keys()) {
			if (!present.has(workId)) {
				listed.delete(workId);
			}
		}
		return heads.flatMap((head) => {
			const entry = listed.get(head.work_id);
			return entry === undefined ? [] : [entry.stored];
		});
	});
}
