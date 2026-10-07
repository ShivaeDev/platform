import { Schema } from "effect";
import { RequestReceipt } from "@shivaedev/work-board/attention/RequestReceipt.ts";
import { RecordedResponse } from "@shivaedev/work-board/browser/responses/schema.ts";

export const BoardDecision = Schema.Struct({
	itemId: Schema.String,
	questionId: Schema.String,
	request: Schema.String,
	revision: Schema.String,
	sourcePath: Schema.String,
	workId: Schema.String,
	workRevision: Schema.String,
	workSourcePath: Schema.String,
});
export type BoardDecision = typeof BoardDecision.Type;

export const BoardDecisionAcknowledgement = Schema.Struct({
	decision: BoardDecision,
	disposition: RequestReceipt.fields.disposition,
	recordedAt: RequestReceipt.fields.recordedAt,
	responseId: Schema.optional(Schema.String),
});
export type BoardDecisionAcknowledgement = typeof BoardDecisionAcknowledgement.Type;

export const BoardDecisionReading = Schema.Union([
	Schema.Struct({ _tag: Schema.Literal("Pending") }),
	Schema.Struct({ _tag: Schema.Literal("Stale"), reason: Schema.String }),
	Schema.Struct({ _tag: Schema.Literal("Ambiguous"), responseIds: Schema.Array(Schema.String) }),
	Schema.Struct({ _tag: Schema.Literal("Response"), response: RecordedResponse }),
]);
export type BoardDecisionReading = typeof BoardDecisionReading.Type;
