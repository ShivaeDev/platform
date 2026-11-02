import { Effect, Option, Schema, Stream } from "effect";
import { decodedPages } from "#pagedLists.ts";
import type { Representations } from "#representations.ts";

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

export function checkRuns(client: Representations) {
	const createCheckRun = Effect.fn("GitHub.createCheckRun")(function* (owner: string, repo: string, input: typeof CreateCheckRun.Type) {
		const body = yield* Schema.encodeEffect(CreateCheckRun)(input);
		const response = yield* client.write("POST", `/repos/${owner}/${repo}/check-runs`, body);
		return yield* response.decode(CheckRun);
	});
	const updateCheckRun = Effect.fn("GitHub.updateCheckRun")(function* (owner: string, repo: string, id: number, input: typeof UpdateCheckRun.Type) {
		const body = yield* Schema.encodeEffect(UpdateCheckRun)(input);
		const response = yield* client.write("PATCH", `/repos/${owner}/${repo}/check-runs/${id}`, body);
		return yield* response.decode(CheckRun);
	});
	const findLatestCheckRun = Effect.fn("GitHub.findLatestCheckRun")(function* (owner: string, repo: string, input: typeof FindCheckRun.Type) {
		const { headSha, name, appId } = yield* Schema.decodeUnknownEffect(FindCheckRun)(input);
		const query = new URLSearchParams({ filter: "all", "per_page": "100" });
		if (name !== undefined) {
			query.set("check_name", name);
		}
		const pages = decodedPages(client, `/repos/${owner}/${repo}/commits/${encodeURIComponent(headSha)}/check-runs?${query}`, CheckRun, {
			arrayKey: "check_runs",
		});
		return yield* pages.pipe(
			Stream.flatMap((page) => Stream.fromIterable(page.items)),
			Stream.filter((run) => (name === undefined || run.name === name) && (appId === undefined || run.app?.id === appId)),
			Stream.runFold(
				() => Option.none<typeof CheckRun.Type>(),
				(latest, run) => (Option.isNone(latest) || run.id > latest.value.id ? Option.some(run) : latest),
			),
		);
	});
	const upsertCheckRun = Effect.fn("GitHub.upsertCheckRun")(function* (
		owner: string,
		repo: string,
		input: typeof CreateCheckRun.Type,
		appId?: number,
	) {
		yield* Schema.encodeEffect(CreateCheckRun)(input);
		const existing = yield* findLatestCheckRun(owner, repo, { appId, headSha: input.headSha, name: input.name });
		return yield* Option.isSome(existing) ? updateCheckRun(owner, repo, existing.value.id, input) : createCheckRun(owner, repo, input);
	});
	return { createCheckRun, findLatestCheckRun, updateCheckRun, upsertCheckRun };
}
