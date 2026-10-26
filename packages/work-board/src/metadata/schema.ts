import { Schema } from "effect";
import { RequestReceipt } from "#attention/RequestReceipt.ts";
import { HandoffRecord } from "#browser/handoffs/schema.ts";
import { QuestionRecord, ResponseRecord } from "#browser/responses/schema.ts";
import { Identity as SourceIdentity } from "#path/Identity.ts";

export const Identity = SourceIdentity;
export const Reference = Schema.String.check(Schema.isPattern(/^[a-zA-Z\d][a-zA-Z\d._-]*(?:#[a-zA-Z\d][a-zA-Z\d._-]*)?$/u));
const Text = Schema.String.check(Schema.isPattern(/\S/u));
const SweepPath = Text.check(
	Schema.makeFilter(
		(value) =>
			(value === value.trim() && !/^[\\/]|^[a-z]:|\\/iu.test(value) && !value.split("/").some((part) => part === ".." || part === "." || part === ""))
			|| "Expected a repository-relative path glob",
	),
);
const Attention = Schema.Struct({
	id: Identity,
	kind: Schema.Literals(["decision", "review", "blocker"]),
	managed: Schema.optional(Schema.Boolean),
	reason: Text,
	responseFrom: Schema.Array(Text).check(Schema.isMinLength(1)),
	state: Schema.Literals(["open", "closed"]),
	unblocks: Schema.Array(Reference).check(Schema.isMinLength(1)),
}).pipe(Schema.encodeKeys({ responseFrom: "response_from" }));
const Criterion = Schema.Struct({ id: Identity, text: Text });
const Relationship = Schema.Struct({ kind: Schema.Literals(["implements", "informs", "depends_on", "relates_to", "replaces"]), target: Reference });
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
	areas: Schema.optional(Schema.Array(Text)),
	attention: Schema.optional(Schema.Array(Attention)),
	criteria: Schema.optional(Schema.Array(Criterion)),
	delivers: Schema.optional(Schema.Literals(["pr", "report"])),
	evidence: Schema.optional(Schema.Array(Evidence)),
	fleet: Schema.optional(Schema.Literals(["approved", "held", "manual"])),
	handoff: Schema.optional(HandoffRecord),
	id: Schema.optional(Identity),
	items: Schema.optional(Schema.Array(Identity)),
	kind: Schema.optional(Schema.Literals(["goal", "task", "question", "report"])),
	nextAction: Schema.optional(Text),
	options: Schema.optional(
		Schema.Array(Schema.Struct({ description: Text.check(Schema.isMaxLength(8192)), label: Text.check(Schema.isMaxLength(128)) })).check(
			Schema.isMaxLength(32),
		),
	),
	owner: Schema.optional(Schema.Literals(["codex", "claude", "marvin"])),
	question: Schema.optional(QuestionRecord),
	recommended: Schema.optional(Text),
	relationships: Schema.optional(Schema.Array(Relationship)),
	requestReceipt: Schema.optional(RequestReceipt),
	response: Schema.optional(ResponseRecord),
	scope: Schema.optional(Schema.Literals(["task", "area", "standing"])),
	standing: Schema.optional(Schema.Boolean),
	status: Schema.optional(Schema.Literals(["draft", "ready", "done", "deferred", "dropped"])),
	sweep: Schema.optional(Schema.Array(SweepPath).check(Schema.isMinLength(1))),
	urgency: Schema.optional(Schema.Literals(["blocking", "whenever"])),
}).pipe(Schema.encodeKeys({ nextAction: "next_action", requestReceipt: "request_receipt" }));
export type Metadata = typeof Metadata.Type;
