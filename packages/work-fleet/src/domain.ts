import { Schema } from "effect";
export const Text = Schema.String.check(Schema.isMinLength(1), Schema.isPattern(/\S/u));
export const Scope = Schema.Struct({ key: Schema.NullOr(Text), path: Text });
export const WorkSpec = Schema.Struct({
	baseBranch: Text,
	checkout: Text,
	completion: Schema.Literals(["pull-request", "merged", "no-change"]),
	id: Text,
	instructions: Text,
	pullRequest: Schema.optional(Schema.Struct({ body: Text, title: Text })),
	repository: Text,
	requiredChecks: Schema.Array(Text),
	scope: Schema.Array(Scope),
});
export type WorkSpec = typeof WorkSpec.Type;
export const Batch = Schema.Struct({ id: Text, works: Schema.Array(WorkSpec) });
export type Batch = typeof Batch.Type;
export const Outcome = Schema.Union([
	Schema.Struct({ kind: Schema.Literal("branch"), revision: Text }),
	Schema.Struct({ kind: Schema.Literal("pull-request"), number: Schema.Number, revision: Text, url: Text }),
	Schema.Struct({ justification: Text, kind: Schema.Literal("no-change"), revision: Text }),
]);
export type Outcome = typeof Outcome.Type;
export const AgentResult = Schema.Union([
	Schema.Struct({ kind: Schema.Literal("outcome"), outcome: Outcome }),
	Schema.Struct({ kind: Schema.Literal("review"), revision: Text, summary: Text, verdict: Schema.Literals(["approve", "repair"]) }),
]);
export type AgentResult = typeof AgentResult.Type;
export const ProviderRef = Schema.Struct({ sessionId: Text, turnId: Schema.NullOr(Text) });
export type ProviderRef = typeof ProviderRef.Type;
export const Attempt = Schema.Struct({
	createdAt: Schema.Number,
	feedback: Schema.String,
	id: Text,
	ref: Schema.NullOr(ProviderRef),
	result: Schema.NullOr(AgentResult),
	revision: Schema.NullOr(Text),
	role: Schema.Literals(["worker", "reviewer"]),
	status: Schema.Literals(["prepared", "submitting", "accepted", "running", "uncertain", "completed", "failed"]),
	workId: Text,
});
export type Attempt = typeof Attempt.Type;
export const Review = Schema.Struct({ attemptId: Text, revision: Text, summary: Text, verdict: Schema.Literals(["approve", "repair"]) });
export const Question = Schema.Struct({ context: Text, link: Text, question: Text, recommendation: Text });
export const PullRequest = Schema.Struct({
	baseRevision: Text,
	checks: Schema.Array(Schema.Struct({ name: Text, status: Schema.Literals(["pending", "passed", "failed"]) })),
	mergeable: Schema.Literals(["ready", "conflict", "blocked", "unknown"]),
	number: Schema.Number,
	revision: Text,
	state: Schema.Literals(["open", "closed", "merged"]),
	url: Text,
});
export type PullRequest = typeof PullRequest.Type;
export const Work = Schema.Struct({
	batchId: Text,
	feedback: Schema.String,
	merge: Schema.Literals(["none", "intent", "uncertain", "acknowledged"]),
	observation: Schema.NullOr(PullRequest),
	outcome: Schema.NullOr(Outcome),
	phase: Schema.Literals(["queued", "working", "reviewing", "repair", "delivery", "completed", "held"]),
	publish: Schema.Literals(["none", "intent", "uncertain", "acknowledged"]),
	question: Schema.NullOr(Question),
	review: Schema.NullOr(Review),
	spec: WorkSpec,
	validation: Schema.NullOr(Schema.Struct({ at: Schema.Number, baseRevision: Text, checks: Schema.Array(Text), revision: Text })),
});
export type Work = typeof Work.Type;
export const Decision = Schema.Struct({
	action: Schema.Literals(["approve", "merge", "hold", "resume", "attach", "reject-submission"]),
	at: Schema.Number,
	attemptId: Schema.optional(Text),
	id: Text,
	reason: Text,
	ref: Schema.optional(ProviderRef),
	workId: Text,
});
export type Decision = typeof Decision.Type;
export const Policy = Schema.Struct({
	capacity: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
	maxAttempts: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
	quotaAvailable: Schema.Boolean,
	stopped: Schema.Boolean,
});
export type Policy = typeof Policy.Type;
export const State = Schema.Struct({
	attempts: Schema.Array(Attempt),
	backend: Schema.NullOr(Text),
	decisions: Schema.Array(Decision),
	policy: Policy,
	version: Schema.Literal(1),
	works: Schema.Array(Work),
});
export type State = typeof State.Type;
export const initialState: State = {
	attempts: [],
	backend: null,
	decisions: [],
	policy: { capacity: 2, maxAttempts: 100, quotaAvailable: true, stopped: false },
	version: 1,
	works: [],
};
