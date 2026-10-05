import { Schema } from "effect";
import { isMarkdown } from "#files/list.ts";

const File = Schema.String.check(
	Schema.makeFilter(
		(value) =>
			(isMarkdown(value) && !value.includes("\\") && !value.includes("\0") && value.split("/").every((part) => part.length > 0 && part !== ".."))
			|| "Expected a relative readable Markdown path",
	),
);
const ObservedTime = Schema.String.check(
	Schema.makeFilter(
		(value) =>
			(Number.isFinite(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/u.exec(value) !== null)
			|| "Expected an ISO observation time with timezone",
	),
);
export const Baseline = Schema.Struct({
	documents: Schema.Array(Schema.Struct({ file: File, source: Schema.String })).check(
		Schema.makeFilter(
			(values) => new Set(values.map((value) => value.file)).size === values.length || "Duplicate source paths are not a complete observation",
		),
	),
	recordedAt: ObservedTime,
	version: Schema.Literal(1),
}).pipe(Schema.encodeKeys({ recordedAt: "recorded_at" }));
export type Baseline = typeof Baseline.Type;

export const HistoryInput = Schema.Struct({ action: Schema.Literals(["check", "compare", "observe"]), baseline: Schema.NullOr(Schema.String) });
export const HistoryOutput = Schema.Struct({
	discardBaseline: Schema.Boolean,
	html: Schema.String,
	reason: Schema.String,
	snapshot: Schema.NullOr(Schema.String),
});
export type HistoryOutput = typeof HistoryOutput.Type;
