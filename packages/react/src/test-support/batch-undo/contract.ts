import { Effect, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";

export const Row = Schema.Struct({ id: Schema.String, portion: Schema.Number, version: Schema.Number });
export const Guard = Schema.Struct({ expectedVersion: Schema.Number, id: Schema.String });
const Token = Schema.Array(Schema.Struct({ ...Guard.fields, before: Schema.NullOr(Row) }));
export const Input = Schema.Union([
	Schema.Struct({ _tag: Schema.Literal("edit"), copies: Schema.Boolean, rows: Schema.Array(Guard), scale: Schema.Number }),
	Schema.Struct({ _tag: Schema.Literal("undo"), token: Token }),
]);
const rowsKey = collection("batch_undo_rows", Schema.String);
export const Change = command("change", {
	invalidates: () => [rowsKey.list],
	payload: Input,
	rejections: { Conflict },
	success: Schema.Struct({ undo: Token }),
});
export const Rows = contract("batchUndo", {
	commands: [Change],
	queries: [query("list", { readPolicy: () => Effect.succeed(true), reads: () => [rowsKey.list], success: Schema.Array(Row) })],
});
