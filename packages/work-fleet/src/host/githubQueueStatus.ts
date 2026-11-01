import { Effect, Schema } from "effect";
import { GithubApi } from "#host/githubApi.ts";
import { githubChecks } from "#host/githubChecks.ts";
import { githubFailure } from "#host/githubRateLimit.ts";
import type { ChangeResult } from "#policy.ts";

const Response = Schema.Struct({
	data: Schema.Struct({
		node: Schema.Struct({
			autoMergeRequest: Schema.NullOr(Schema.Struct({ enabledAt: Schema.String })),
			mergeQueueEntry: Schema.NullOr(Schema.Struct({ id: Schema.String })),
			state: Schema.String,
			timelineItems: Schema.Struct({
				nodes: Schema.Array(
					Schema.Struct({
						__typename: Schema.String,
						beforeCommit: Schema.optional(Schema.NullOr(Schema.Struct({ oid: Schema.String }))),
						createdAt: Schema.optional(Schema.String),
						reason: Schema.optional(Schema.NullOr(Schema.String)),
					}),
				),
			}),
		}),
	}),
});

const query = `query FleetQueueStatus($pr: ID!) {
	node(id: $pr) {
		... on PullRequest {
			state
			autoMergeRequest { enabledAt }
			mergeQueueEntry { id }
			timelineItems(last: 1, itemTypes: [ADDED_TO_MERGE_QUEUE_EVENT, REMOVED_FROM_MERGE_QUEUE_EVENT]) {
				nodes {
					__typename
					... on RemovedFromMergeQueueEvent { createdAt reason beforeCommit { oid } }
				}
			}
		}
	}
}`;

export const readQueueState = Effect.fn("FleetHost.readQueueState")(function* (pr: string) {
	const github = yield* GithubApi;
	const response = yield* github
		.write({ query, variables: { pr } })
		.pipe(
			Effect.flatMap(Schema.decodeUnknownEffect(Response)),
			Effect.mapError(githubFailure("GitHub merge queue evidence is unavailable or invalid")),
		);
	return response.data.node;
});

export const githubQueueStatus = Effect.fn("FleetHost.githubQueueStatus")(function* (
	pr: string,
	result: typeof ChangeResult.Type,
	branch: string,
	queued: boolean,
	queuedAt?: number,
) {
	const observed = yield* readQueueState(pr);
	if (observed.state !== "OPEN") {
		return "pending" as const;
	}
	if (observed.mergeQueueEntry !== null || observed.autoMergeRequest !== null) {
		return "queued" as const;
	}
	const failure = yield* queueFailure(result, branch, observed.timelineItems.nodes.at(-1), queuedAt);
	return failure ?? (queued ? ("pending" as const) : undefined);
});

type QueueEvent = Effect.Success<ReturnType<typeof readQueueState>>["timelineItems"]["nodes"][number];
const queueFailure = Effect.fn("FleetHost.queueFailure")(function* (
	result: typeof ChangeResult.Type,
	branch: string,
	removal: QueueEvent | undefined,
	queuedAt: number | undefined,
) {
	if (removal?.__typename !== "RemovedFromMergeQueueEvent" || removal.reason !== "failed_checks") {
		return undefined;
	}
	if (queuedAt === undefined || !(Date.parse(removal.createdAt ?? "") >= queuedAt)) {
		return undefined;
	}
	const commit = removal.beforeCommit?.oid;
	if (commit === undefined) {
		return "pending" as const;
	}
	const github = yield* GithubApi;
	const checks = yield* githubChecks(github, branch)({ ...result, head: commit });
	return checks.repairPrompt === undefined
		? ("pending" as const)
		: {
				repairPrompt: `GitHub removed ${result.pr} from the merge queue for failed checks.\n${checks.repairPrompt}`,
				status: "failed" as const,
			};
});
