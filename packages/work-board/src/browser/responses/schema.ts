import { Schema } from "effect";
import { Identity } from "#path/Identity.ts";

export const Revision = Schema.String.check(Schema.isPattern(/^[a-f\d]{64}$/u));
export const ResponseKind = Schema.Literals(["answer", "clarify", "not_now"]);
export const QuestionRecord = Schema.Struct({
	deadline: Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(8_640_000_000_000_000)),
	item: Identity,
	reason: Schema.String,
	registeredAt: Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(8_640_000_000_000_000)),
	request: Identity,
	reviewedRevision: Revision,
	source: Schema.String,
});
export const ResponseRecord = Schema.Struct({
	author: Schema.String.check(Schema.isPattern(/\S/u), Schema.isMaxLength(200)),
	question: Identity,
	recordedAt: Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(8_640_000_000_000_000)),
	reviewedRevision: Revision,
	type: ResponseKind,
});
export const QuestionPreview = Schema.Struct({
	context: Schema.String,
	id: Identity,
	item: Identity,
	reason: Schema.String,
	request: Identity,
	reviewedRevision: Revision,
	source: Schema.String,
});
export type QuestionPreview = typeof QuestionPreview.Type;
export const Question = Schema.Struct({ context: Schema.String, id: Identity, question: QuestionRecord });
export const RecordedResponse = Schema.Struct({ body: Schema.String, id: Identity, response: ResponseRecord });
export const Reading = Schema.Struct({ question: Question, responses: Schema.Array(RecordedResponse) });
export const WaitReading = Schema.Struct({ expired: Schema.Boolean, question: Question, response: Schema.optional(RecordedResponse) });
export type WaitReading = typeof WaitReading.Type;
export class ResponseFailed extends Schema.TaggedError<ResponseFailed>()("ResponseFailed", {
	cause: Schema.optional(Schema.Defect()),
	code: Schema.Literals(["Disabled", "Missing", "Stale", "Conflict", "Unavailable", "Unsupported", "Uncertain", "Unanswered"]),
	message: Schema.String,
}) {}
export const DraftInput = Schema.Struct({
	author: ResponseRecord.fields.author,
	body: Schema.String.check(Schema.isPattern(/\S/u), Schema.isMaxLength(32_768)),
	id: Identity,
	question: Identity,
	type: ResponseKind,
});
export type Question = typeof Question.Type;
export type RecordedResponse = typeof RecordedResponse.Type;
export type Reading = typeof Reading.Type;
export type DraftInput = typeof DraftInput.Type;
