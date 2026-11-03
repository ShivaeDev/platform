import * as HttpStatus from "effect/http/HttpStatus";
import { githubGraphql } from "./githubGraphql.ts";
import { GRAPHQL, type GraphqlQuery, OPEN_LIST, pullDetail, QUEUE_REFS, REPOSITORY, type Reply } from "./githubModel.ts";
import type { GitHubState } from "./githubState.ts";

export function githubReplies(state: GitHubState) {
	const { pulls, open, queueRefs, checks, statuses, checkRuns, overrides, extraHeaders } = state;
	const graphqlReply = githubGraphql(state);
	function listReply(route: string): Reply | undefined {
		if (route === OPEN_LIST) {
			return { body: [...open].map((number) => ({ number })) };
		}
		if (route === QUEUE_REFS) {
			return { body: [...queueRefs].map((number) => ({ ref: `refs/heads/gh-readonly-queue/main/pr-${number}-abc` })) };
		}
		return undefined;
	}

	function detailReply(route: string): Reply | undefined {
		const detail = /^\/pulls\/(?<number>\d+)$/u.exec(route)?.groups?.number;
		const pull = detail === undefined ? undefined : pulls.get(Number(detail));
		return pull === undefined ? undefined : { body: pullDetail(pull, Number(detail)) };
	}

	function commitReply(route: string): Reply | undefined {
		const checksSha = /^\/commits\/(?<sha>[^/]+)\/check-runs\?per_page=100&filter=latest$/u.exec(route)?.groups?.sha;
		if (checksSha !== undefined) {
			return { body: checkRuns(checksSha, checks.get(checksSha) ?? []) };
		}
		const statusSha = /^\/commits\/(?<sha>[^/]+)\/status$/u.exec(route)?.groups?.sha;
		const status = statusSha === undefined ? undefined : statuses.get(statusSha);
		if (statusSha === undefined) {
			return undefined;
		}
		return {
			body: status === undefined ? { state: "success", statuses: [] } : { state: status.state, statuses: [{ context: "ci", state: status.state }] },
		};
	}

	function restReply(route: string): Reply {
		return (
			listReply(route) ?? detailReply(route) ?? commitReply(route) ?? { body: { message: "Not Found" }, status: HttpStatus.fromLiteral("NotFound") }
		);
	}

	function replyTo(path: string, body: GraphqlQuery | undefined): Reply {
		if (path === GRAPHQL || path === `/api${GRAPHQL}`) {
			return graphqlReply(body);
		}
		const route = path.replace(/^\/api\/v3/u, "").replace(REPOSITORY, "");
		const reply = overrides.get(route) ?? restReply(route);
		const headers = extraHeaders.get(route);
		return headers === undefined ? reply : { ...reply, headers: { ...headers, ...reply.headers } };
	}

	return replyTo;
}
