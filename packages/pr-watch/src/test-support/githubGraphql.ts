import * as HttpStatus from "effect/http/HttpStatus";
import { GRAPHQL, type GraphqlQuery, type Pull, REQUIRED_CHECKS, type Reply } from "#test/githubModel.ts";
import type { GitHubState } from "#test/githubState.ts";

const NEXT_REQUIRED_PAGE = "next";

function schemaErrors(query: string) {
	const itemType = /itemTypes:\s*\[(?<type>\w+)\]/u.exec(query)?.groups?.type;
	const fragment = /\.\.\. on (?<type>\w+)/u.exec(query)?.groups?.type;
	return [
		...(itemType !== undefined && itemType !== "REMOVED_FROM_MERGE_QUEUE_EVENT"
			? [
					{
						message: `Argument 'itemTypes' on Field 'timelineItems' has an invalid value ([${itemType}]). Expected type '[PullRequestTimelineItemsItemType!]'.`,
					},
				]
			: []),
		...(fragment !== undefined && fragment !== "RemovedFromMergeQueueEvent"
			? [{ message: `No such type ${fragment}, so it can't be a fragment condition` }]
			: []),
	];
}

function pullRequestNode(pull: Pull, number: number, queued: boolean, reason: string | undefined) {
	return {
		autoMergeRequest: pull.autoMerge ? { enabledAt: "2026-01-01T00:00:00Z" } : null,
		mergeQueueEntry: queued ? { id: `entry-${number}` } : null,
		state: pull.merged ? "MERGED" : pull.state.toUpperCase(),
		timelineItems: { nodes: reason === undefined ? [] : [{ reason }] },
	};
}

export function githubGraphql(state: GitHubState) {
	const { pulls, queueEntries, dequeueReasons, statuses, checkRequired, requiredFlagsPaged, overrides } = state;
	function confirmation({ query, variables }: GraphqlQuery): Reply {
		const errors = schemaErrors(query);
		if (errors.length > 0) {
			return { body: { errors } };
		}
		const pull = pulls.get(variables.number);
		const queued = queueEntries.has(variables.number);
		const reason = dequeueReasons.get(variables.number);
		return {
			body: { data: { repository: { pullRequest: pull === undefined ? null : pullRequestNode(pull, variables.number, queued, reason) } } },
		};
	}

	function requiredFlags({ variables }: GraphqlQuery): Reply {
		const sha = variables.sha ?? "";
		const status = statuses.get(sha);
		const nodes = [
			...[...checkRequired].map(([id, isRequired]) => ({ __typename: "CheckRun", id, isRequired })),
			...(status === undefined ? [] : [{ __typename: "StatusContext", context: "ci", isRequired: status.required }]),
		];
		const firstOfTwo = requiredFlagsPaged.has(sha) && variables.after !== NEXT_REQUIRED_PAGE;
		const contexts = firstOfTwo
			? { nodes: [], pageInfo: { endCursor: NEXT_REQUIRED_PAGE, hasNextPage: true } }
			: { nodes, pageInfo: { endCursor: null, hasNextPage: false } };
		return { body: { data: { repository: { object: { statusCheckRollup: { contexts } } } } } };
	}

	function graphqlReply(body: GraphqlQuery | undefined): Reply {
		if (body === undefined) {
			return { body: {}, status: HttpStatus.fromLiteral("BadRequest") };
		}
		if (body.query.includes("query RequiredChecks")) {
			return overrides.get(REQUIRED_CHECKS) ?? requiredFlags(body);
		}
		return overrides.get(GRAPHQL) ?? confirmation(body);
	}

	return graphqlReply;
}
