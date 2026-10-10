import { Schema } from "effect";
import { Revision } from "#browser/responses/schema.ts";
import { Identity } from "#path/Identity.ts";

export const RequestReceipt = Schema.Struct({
	disposition: Schema.Literals(["applied", "superseded"]),
	question: Identity,
	recordedAt: Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(8_640_000_000_000_000)),
	response: Schema.optional(Identity),
	reviewedRevision: Revision,
});
export type RequestReceipt = typeof RequestReceipt.Type;
