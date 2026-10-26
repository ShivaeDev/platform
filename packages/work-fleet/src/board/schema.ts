import { Schema } from "effect";
import { attention } from "@shivaedev/work-board/server/integration/attention.ts";
import { responses } from "@shivaedev/work-board/server/integration/responses.ts";
import { SessionReceipt } from "#session/schema.ts";

const { RequestReceipt } = attention;
const { RecordedResponse } = responses;

export const BoardReport = Schema.Struct({
	itemId: Schema.String,
	receipt: SessionReceipt,
	revision: Schema.String,
	sourcePath: Schema.String,
	workRevision: Schema.String,
});
export type BoardReport = typeof BoardReport.Type;

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

export class BoardAcknowledgementStale extends Schema.TaggedError<BoardAcknowledgementStale>()("BoardAcknowledgementStale", {
	message: Schema.String,
}) {}

export const BoardDecisionReading = Schema.Union([
	Schema.Struct({ _tag: Schema.Literal("Pending") }),
	Schema.Struct({ _tag: Schema.Literal("Stale"), reason: Schema.String }),
	Schema.Struct({ _tag: Schema.Literal("Closed") }),
	Schema.Struct({ _tag: Schema.Literal("Ambiguous"), responseIds: Schema.Array(Schema.String) }),
	Schema.Struct({ _tag: Schema.Literal("Response"), response: RecordedResponse }),
]);
export type BoardDecisionReading = typeof BoardDecisionReading.Type;

export const ClosedDecision = Schema.Struct({ reason: Schema.String, sourcePath: Schema.String, workId: Schema.String });
export type ClosedDecision = typeof ClosedDecision.Type;
