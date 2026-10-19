import { Schema } from "effect";
import { HandoffPreview, HandoffReading } from "#browser/handoffs/schema.ts";
import { DiagnosticsSnapshot } from "#diagnostics/daemonContract.ts";

export const DiagnosticsProjection = Schema.Struct({ now: Schema.Number, sources: DiagnosticsSnapshot });
export type DiagnosticsProjection = typeof DiagnosticsProjection.Type;

export const StartProjection = Schema.Struct({
	empty: Schema.Boolean,
	templates: Schema.Array(Schema.Struct({ file: Schema.String, label: Schema.String, source: Schema.String })),
});
export type StartProjection = typeof StartProjection.Type;
export const HandoffProjection = Schema.Struct({
	background: Schema.String,
	goal: Schema.String,
	item: Schema.String,
	nextAction: Schema.String,
	owner: Schema.optional(Schema.String),
	reading: HandoffReading,
	source: Schema.optional(HandoffPreview),
	status: Schema.optional(Schema.String),
	title: Schema.String,
	unavailable: Schema.optional(Schema.String),
	writable: Schema.Boolean,
});
export type HandoffProjection = typeof HandoffProjection.Type;
