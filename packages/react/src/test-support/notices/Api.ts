import { Effect, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";

export class Conflict extends Schema.TaggedError<Conflict>()("Conflict", { current: Schema.Number, expected: Schema.Number }) {}
export class Rejected extends Schema.TaggedError<Rejected>()("Rejected", {}) {}
export class TitleRejected extends Schema.TaggedError<TitleRejected>()("TitleRejected", { field: Schema.Literal("title"), message: Schema.String }) {}
const rows = collection("notice-rows", Schema.String);
export const Removed = Schema.Struct({ expectedVersion: Schema.Number, title: Schema.String });
const Remove = command("remove", {
	invalidates: () => [rows.list],
	payload: { title: Schema.String },
	rejections: { Rejected },
	success: Removed,
});
const Restore = command("restore", {
	invalidates: () => [rows.list],
	payload: Removed.fields,
	rejections: { Conflict },
	success: Schema.String,
});
const Save = command("save", {
	invalidates: () => [rows.list],
	payload: { title: Schema.String },
	rejections: { TitleRejected },
	success: Schema.String,
});
const Edit = command("edit", { invalidates: () => [rows.list], payload: { title: Schema.String } });
const List = query("list", { readPolicy: () => Effect.succeed(true), reads: () => [rows.list], rejections: { Rejected }, success: Schema.String });
const BreakReads = command("breakReads", { invalidates: () => [rows.list] });
export const Api = contract("notices", { commands: [Remove, Restore, Save, Edit, BreakReads], queries: [List] });
