import { Context, Effect, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import type { OptimisticConcurrencyError } from "@shivaedev/sql/repository.ts";

export const Row = Schema.Struct({ id: Schema.String, portion: Schema.Number, version: Schema.Number });
export const Guard = Schema.Struct({ expectedVersion: Schema.Number, id: Schema.String });
const Token = Schema.Array(Schema.Struct({ ...Guard.fields, before: Schema.NullOr(Row) }));
export const Undo = Schema.Struct({ undo: Token });
export const Input = Schema.Union([
	Schema.Struct({ _tag: Schema.Literal("edit"), copies: Schema.Boolean, rows: Schema.Array(Guard), scale: Schema.Number }),
	Schema.Struct({ _tag: Schema.Literal("undo"), token: Token }),
]);
const rowsKey = collection("batch_undo_rows", Schema.String);

export class BatchRows extends Context.Service<
	BatchRows,
	{
		readonly change: (input: typeof Input.Type) => Effect.Effect<typeof Undo.Type, OptimisticConcurrencyError>;
		readonly list: Effect.Effect<readonly (typeof Row.Type)[]>;
	}
>()("@shivaedev/react/test/BatchRows") {}

export const Change = command("change", {
	invalidates: () => [rowsKey.list],
	payload: Input,
	*run(input) {
		return yield* (yield* BatchRows).change(input);
	},
});
export const List = query("list", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [rowsKey.list],
	*run() {
		return yield* (yield* BatchRows).list;
	},
});
export const Rows = defineModule({
	name: "batchUndo",
	operations: [Change, List],
	wire: {
		change: { rejections: { Conflict }, success: Undo },
		list: { rejections: {}, success: Schema.Array(Row) },
	},
});
