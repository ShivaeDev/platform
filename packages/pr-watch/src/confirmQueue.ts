import { type Context, Effect, Schema } from "effect";
import type { GitHubHttp } from "./GitHubHttp.ts";
import { type Options, type Snapshot, WatchError } from "./model.ts";

const QueueResponse = Schema.Struct({
	data: Schema.NullOr(
		Schema.Struct({
			repository: Schema.NullOr(
				Schema.Struct({
					pullRequest: Schema.NullOr(
						Schema.Struct({
							autoMergeRequest: Schema.NullOr(Schema.Struct({ enabledAt: Schema.String })),
							mergeQueueEntry: Schema.NullOr(Schema.Struct({ id: Schema.String })),
							state: Schema.Literals(["OPEN", "CLOSED", "MERGED"]),
							timelineItems: Schema.optionalKey(Schema.Struct({ nodes: Schema.Array(Schema.Struct({ reason: Schema.String })) })),
						}),
					),
				}),
			),
		}),
	),
	errors: Schema.optionalKey(Schema.Array(Schema.Unknown)),
});
const query = `query QueueEntry($owner: String!, $name: String!, $number: Int!) {
	repository(owner: $owner, name: $name) {
		pullRequest(number: $number) {
			state
			autoMergeRequest { enabledAt }
			mergeQueueEntry { id }
			timelineItems(last: 1, itemTypes: [DEQUEUED_EVENT]) { nodes { ... on DequeuedEvent { reason } } }
		}
	}
}`;
export const confirmQueue = Effect.fn("GitHub.confirmQueue")(function* (
	http: Context.Service.Shape<typeof GitHubHttp>,
	options: Options,
	snapshot: Snapshot,
) {
	const url = new URL(options.apiUrl);
	url.pathname = url.pathname.replace(/\/api\/v3\/?$/u, "/api/graphql");
	if (!url.pathname.endsWith("/api/graphql")) {
		url.pathname = `${url.pathname.replace(/\/$/u, "")}/graphql`;
	}
	const [owner, name] = options.repository.split("/");
	const response = yield* http.post(url.href, { query, variables: { name, number: snapshot.number, owner } });
	const body = yield* Schema.decodeUnknownEffect(QueueResponse)(response).pipe(
		Effect.mapError(() => new WatchError({ message: "Invalid GitHub queue confirmation" })),
	);
	const pr = body.data?.repository?.pullRequest;
	if ((body.errors?.length ?? 0) > 0 || pr === undefined || pr === null || pr.state !== "OPEN") {
		return yield* Effect.fail(new WatchError({ message: `Queue confirmation unavailable for PR #${snapshot.number}` }));
	}
	const reason = pr.timelineItems?.nodes.at(-1)?.reason;
	return {
		...snapshot,
		...(reason === undefined ? {} : { dequeueReason: reason }),
		autoMerge: pr.autoMergeRequest !== null,
		queued: pr.mergeQueueEntry !== null || pr.autoMergeRequest !== null,
	};
});
