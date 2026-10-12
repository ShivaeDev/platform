import { Schema } from "effect";
import { Document, DocumentRequest } from "#browser/document/schema.ts";
import { HandoffPreview, HandoffReading } from "#browser/handoffs/schema.ts";
import { DiagnosticsSnapshot } from "#diagnostics/daemonContract.ts";

export const DiagnosticsProjection = Schema.Struct({ now: Schema.Number, sources: DiagnosticsSnapshot });
export type DiagnosticsProjection = typeof DiagnosticsProjection.Type;

export const StartProjection = Schema.Struct({
	empty: Schema.Boolean,
	templates: Schema.Array(Schema.Struct({ file: Schema.String, label: Schema.String, source: Schema.String })),
});
export type StartProjection = typeof StartProjection.Type;
export const RespondProjection = Schema.Struct({ document: Document, request: DocumentRequest });
export type RespondProjection = typeof RespondProjection.Type;
export const HandoffProjection = Schema.Struct({
	background: Schema.String,
	goal: Schema.String,
	item: Schema.String,
	nextAction: Schema.String,
	reading: HandoffReading,
	source: Schema.optional(HandoffPreview),
	unavailable: Schema.optional(Schema.String),
	writable: Schema.Boolean,
});
export type HandoffProjection = typeof HandoffProjection.Type;
