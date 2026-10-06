import { Schema } from "effect";
import { HandoffRecord } from "#browser/handoffs/schema.ts";
import { QuestionRecord, ResponseRecord } from "#browser/responses/schema.ts";
import { Identity as SourceIdentity } from "#path/Identity.ts";

export const Identity = SourceIdentity;
export const Reference = Schema.String.check(Schema.isPattern(/^[a-zA-Z\d][a-zA-Z\d._-]*(?:#[a-zA-Z\d][a-zA-Z\d._-]*)?$/u));
const Text = Schema.String.check(Schema.isPattern(/\S/u));
const Attention = Schema.Struct({
	id: Identity,
	kind: Schema.Literals(["decision", "review", "blocker"]),
	reason: Text,
	responseFrom: Schema.Array(Text).check(Schema.isMinLength(1)),
	state: Schema.Literals(["open", "closed"]),
	unblocks: Schema.Array(Reference).check(Schema.isMinLength(1)),
}).pipe(Schema.encodeKeys({ responseFrom: "response_from" }));
const Criterion = Schema.Struct({ id: Identity, text: Text });
const Relationship = Schema.Struct({ kind: Schema.Literals(["implements", "informs", "depends_on", "relates_to"]), target: Reference });
const Evidence = Schema.Struct({
	checkedRevision: Schema.optional(Schema.String.check(Schema.isPattern(/^(?:[a-f\d]{40}|[a-f\d]{64})$/iu))),
	criterion: Schema.optional(Reference),
	method: Schema.optional(Text),
	observedAt: Schema.optional(
		Text.check(
			Schema.makeFilter(
				(value) =>
					(Number.isFinite(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/u.exec(value) !== null)
					|| "Expected an ISO timestamp with timezone",
			),
		),
	),
	outcome: Schema.optional(Text),
	source: Text,
}).pipe(Schema.encodeKeys({ checkedRevision: "checked_revision", observedAt: "observed_at" }));

export const Metadata = Schema.Struct({
	attention: Schema.optional(Schema.Array(Attention)),
	criteria: Schema.optional(Schema.Array(Criterion)),
	evidence: Schema.optional(Schema.Array(Evidence)),
	handoff: Schema.optional(HandoffRecord),
	id: Schema.optional(Identity),
	items: Schema.optional(Schema.Array(Identity)),
	kind: Schema.optional(Schema.Literals(["task", "investigation", "decision", "result", "project", "board", "question", "response", "handoff"])),
	nextAction: Schema.optional(Text),
	owner: Schema.optional(Text),
	question: Schema.optional(QuestionRecord),
	relationships: Schema.optional(Schema.Array(Relationship)),
	response: Schema.optional(ResponseRecord),
	status: Schema.optional(Text),
}).pipe(Schema.encodeKeys({ nextAction: "next_action" }));
export type Metadata = typeof Metadata.Type;
