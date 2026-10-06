import { Schema } from "effect";
import { Revision } from "#browser/responses/schema.ts";
import { Identity } from "#path/Identity.ts";

const Text = Schema.String.check(Schema.isPattern(/\S/u), Schema.isMaxLength(8192));
const HandoffFields = Schema.Struct({
	by: Schema.optional(Text),
	constraints: Schema.String.check(Schema.isMaxLength(8192)),
	goal: Text,
	item: Identity,
	nextAction: Text,
	note: Schema.optional(Text),
	preparedAt: Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(8_640_000_000_000_000)),
	recipient: Text.check(Schema.isMaxLength(200)),
	reviewedRevision: Revision,
	source: Schema.String,
	state: Schema.Literals(["requested", "acknowledged", "rejected", "unavailable"]),
});
export const HandoffRecord = HandoffFields.pipe(
	Schema.encodeKeys({ nextAction: "next_action", preparedAt: "prepared_at", reviewedRevision: "reviewed_revision" }),
);
export type HandoffRecord = typeof HandoffRecord.Type;
export const HandoffInput = Schema.Struct({
	constraints: HandoffFields.fields.constraints,
	goal: HandoffFields.fields.goal,
	id: Identity,
	item: Identity,
	nextAction: HandoffFields.fields.nextAction,
	recipient: HandoffFields.fields.recipient,
	revision: Revision,
	source: Schema.String,
});
export type HandoffInput = typeof HandoffInput.Type;
export const Handoff = Schema.Struct({ context: Schema.String, file: Schema.String, handoff: HandoffRecord, id: Identity, prompt: Schema.String });
export type Handoff = typeof Handoff.Type;
export const HandoffReading = Schema.Struct({ records: Schema.Array(Handoff), unknown: Schema.Array(Schema.String) });
export const HandoffPreview = Schema.Struct({
	context: Schema.String,
	id: Identity,
	item: Identity,
	reviewedRevision: Revision,
	source: Schema.String,
});
export type HandoffPreview = typeof HandoffPreview.Type;
