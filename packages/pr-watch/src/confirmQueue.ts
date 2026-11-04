import { Effect, Schema } from "effect";
import { GitHubGraphqlError } from "@shivaedev/github/errors.ts";
import { decodeGraphqlData } from "@shivaedev/github/graphqlRequests.ts";
import { GitHubHttp } from "#GitHubHttp.ts";
import { type Options, type Snapshot, WatchError } from "#model.ts";

const QueueResponse = Schema.NullOr(
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
);
const query = `query QueueEntry($owner: String!, $name: String!, $number: Int!) {
	repository(owner: $owner, name: $name) {
		pullRequest(number: $number) {
			state
			autoMergeRequest { enabledAt }
			mergeQueueEntry { id }
			timelineItems(last: 1, itemTypes: [REMOVED_FROM_MERGE_QUEUE_EVENT]) { nodes { ... on RemovedFromMergeQueueEvent { reason } } }
		}
	}
}`;
export const confirmQueue = Effect.fn("GitHub.confirmQueue")(function* (options: Options, snapshot: Snapshot) {
	const http = yield* GitHubHttp;
	const [owner, name] = options.repository.split("/");
	const body = yield* http.graphql(options.apiUrl, query, { name, number: snapshot.number, owner }).pipe(
		Effect.flatMap((response) => decodeGraphqlData(response, Schema.Unknown)),
		Effect.flatMap(
			Effect.fnUntraced(function* ({ data, errors }) {
				if (errors.length > 0) {
					return yield* new GitHubGraphqlError({ errors });
				}
				return yield* Schema.decodeUnknownEffect(QueueResponse)(data);
			}),
		),
		Effect.catchTag("GitHubGraphqlError", (cause) =>
			Effect.fail(new WatchError({ message: `GitHub queue confirmation: ${cause.message}`, reason: "response" }, { cause })),
		),
		Effect.catchTag("SchemaError", (cause) =>
			Effect.fail(new WatchError({ message: "Invalid GitHub queue confirmation", reason: "response" }, { cause })),
		),
	);
	const pr = body?.repository?.pullRequest;
	if (pr === undefined || pr === null || pr.state !== "OPEN") {
		return yield* Effect.fail(new WatchError({ message: `Queue confirmation unavailable for PR #${snapshot.number}`, reason: "response" }));
	}
	const reason = pr.timelineItems?.nodes.at(-1)?.reason;
	return {
		...snapshot,
		...(reason === undefined ? {} : { dequeueReason: reason }),
		autoMerge: pr.autoMergeRequest !== null,
		queued: pr.mergeQueueEntry !== null || pr.autoMergeRequest !== null,
	};
});
