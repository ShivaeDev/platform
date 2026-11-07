import { Effect, Schema } from "effect";
import type * as Reactivity from "effect/reactivity/Reactivity";
import { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { transact } from "@shivaedev/sql/transact.ts";
import { Change, type Input, Row } from "#test/batch-undo/contract.ts";

class StoredRow extends Model.Class<StoredRow>("BatchUndoRow")({
	...Row.fields,
	version: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
}) {}
type UndoEntry = (typeof Change.success.Type)["undo"][number];

export const makeStore = Effect.gen(function* () {
	const services = yield* Effect.context<SqlClient.SqlClient | Reactivity.Reactivity>();
	const rows = yield* makeRepository(StoredRow, {
		idColumn: "id",
		spanPrefix: "BatchUndoRows",
		tableName: "batch_undo_rows",
		versionColumn: "version",
	}).pipe(Effect.orDie);
	const restore = Effect.fnUntraced(function* (token: readonly UndoEntry[]) {
		for (const entry of token) {
			if (entry.before === null) {
				yield* rows.delete(entry.id, entry.expectedVersion);
			} else {
				yield* rows.update({ ...entry.before, version: entry.expectedVersion });
			}
		}
		return { undo: [] };
	});
	const edit = Effect.fnUntraced(function* (input: Extract<typeof Input.Type, { readonly _tag: "edit" }>) {
		const undo: UndoEntry[] = [];
		for (const guard of input.rows) {
			const before = yield* rows.findById(guard.id);
			const saved = yield* rows.update({ id: guard.id, portion: before.portion * input.scale, version: guard.expectedVersion });
			undo.push({ before, expectedVersion: saved.version, id: saved.id });
			if (input.copies) {
				const copy = yield* rows.insert({ id: `${saved.id}-copy`, portion: saved.portion });
				undo.push({ before: null, expectedVersion: copy.version, id: copy.id });
			}
		}
		return { undo };
	});
	function change(input: typeof Input.Type) {
		return (input._tag === "undo" ? restore(input.token) : edit(input)).pipe(
			transact({ onSqlError: (error) => error }),
			Effect.catchTag("OptimisticConcurrencyError", (error) => Change.reject.Conflict({ message: `Stale version for ${error.id}` })),
			Effect.catchTags({ NoSuchElementError: Effect.die, SchemaError: Effect.die, SqlError: Effect.die }),
			Effect.provideContext(services),
		);
	}
	return {
		change,
		list: () => rows.findMany({ orderBy: { direction: "asc", field: "id" } }).pipe(Effect.orDie),
	};
});
