import { Effect, Schema } from "effect";
import type { Representations } from "#representations.ts";

export const CheckRunOutput = Schema.Struct({
	summary: Schema.String,
	text: Schema.optional(Schema.String),
	title: Schema.String,
});

export const CheckRunConclusion = Schema.Literals(["action_required", "cancelled", "failure", "neutral", "success", "skipped", "stale", "timed_out"]);
export const CheckRunStatus = Schema.Literals(["queued", "in_progress", "completed"]);

export const CreateCheckRun = Schema.Struct({
	conclusion: Schema.optional(CheckRunConclusion),
	detailsUrl: Schema.optional(Schema.String),
	headSha: Schema.String,
	name: Schema.String,
	output: Schema.optional(CheckRunOutput),
	status: CheckRunStatus,
}).pipe(Schema.encodeKeys({ detailsUrl: "details_url", headSha: "head_sha" }));

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
	conclusion: Schema.NullOr(CheckRunConclusion),
	detailsUrl: Schema.NullOr(Schema.String),
	headSha: Schema.String,
	id: Schema.Number,
	name: Schema.String,
	output: Schema.Struct({ summary: Schema.NullOr(Schema.String), text: Schema.NullOr(Schema.String), title: Schema.NullOr(Schema.String) }),
	status: CheckRunStatus,
}).pipe(Schema.encodeKeys({ detailsUrl: "details_url", headSha: "head_sha" }));

export function checkRuns(client: Representations) {
	return {
		createCheckRun: Effect.fn("GitHub.createCheckRun")(function* (owner: string, repo: string, input: typeof CreateCheckRun.Type) {
			const body = yield* Schema.encodeEffect(CreateCheckRun)(input);
			const response = yield* client.write("POST", `/repos/${owner}/${repo}/check-runs`, body);
			return yield* response.decode(CheckRun);
		}),
		updateCheckRun: Effect.fn("GitHub.updateCheckRun")(function* (owner: string, repo: string, id: number, input: typeof UpdateCheckRun.Type) {
			const body = yield* Schema.encodeEffect(UpdateCheckRun)(input);
			const response = yield* client.write("PATCH", `/repos/${owner}/${repo}/check-runs/${id}`, body);
			return yield* response.decode(CheckRun);
		}),
	};
}
