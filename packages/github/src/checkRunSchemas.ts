import { Schema } from "effect";

export const CheckRunOutput = Schema.Struct({
	summary: Schema.String,
	text: Schema.optional(Schema.String),
	title: Schema.String,
});

export const CheckRunConclusion = Schema.Literals(["action_required", "cancelled", "failure", "neutral", "success", "skipped", "stale", "timed_out"]);
export const CheckRunStatus = Schema.Literals(["queued", "in_progress", "completed", "waiting", "requested", "pending"]);

const createFields = {
	detailsUrl: Schema.optional(Schema.String),
	headSha: Schema.String,
	name: Schema.String,
	output: Schema.optional(CheckRunOutput),
};
export const CreateCheckRun = Schema.Union([
	Schema.Struct({ ...createFields, conclusion: Schema.optional(CheckRunConclusion), status: Schema.Literals(["queued", "in_progress"]) }).pipe(
		Schema.encodeKeys({ detailsUrl: "details_url", headSha: "head_sha" }),
	),
	Schema.Struct({ ...createFields, conclusion: CheckRunConclusion, status: Schema.Literal("completed") }).pipe(
		Schema.encodeKeys({ detailsUrl: "details_url", headSha: "head_sha" }),
	),
]);

export const UpdateCheckRun = Schema.Union([
	Schema.Struct({
		detailsUrl: Schema.optional(Schema.String),
		output: Schema.optional(CheckRunOutput),
		status: Schema.Literals(["queued", "in_progress"]),
	}).pipe(Schema.encodeKeys({ detailsUrl: "details_url" })),
	Schema.Struct({
		conclusion: CheckRunConclusion,
		detailsUrl: Schema.optional(Schema.String),
		output: Schema.optional(CheckRunOutput),
		status: Schema.Literal("completed"),
	}).pipe(Schema.encodeKeys({ detailsUrl: "details_url" })),
]);

export const CheckRun = Schema.Struct({
	app: Schema.optional(Schema.NullOr(Schema.Struct({ id: Schema.Number }))),
	conclusion: Schema.NullOr(CheckRunConclusion),
	detailsUrl: Schema.NullOr(Schema.String),
	headSha: Schema.String,
	id: Schema.Number,
	name: Schema.String,
	output: Schema.Struct({ summary: Schema.NullOr(Schema.String), text: Schema.NullOr(Schema.String), title: Schema.NullOr(Schema.String) }),
	status: CheckRunStatus,
}).pipe(Schema.encodeKeys({ detailsUrl: "details_url", headSha: "head_sha" }));

export const FindCheckRun = Schema.Union([
	Schema.Struct({ appId: Schema.optional(Schema.Number), headSha: Schema.String, name: Schema.String }),
	Schema.Struct({ appId: Schema.Number, headSha: Schema.String, name: Schema.optional(Schema.String) }),
]);
