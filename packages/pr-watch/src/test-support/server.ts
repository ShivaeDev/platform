import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as HttpStatus from "effect/http/HttpStatus";

export interface Reply {
	readonly body: unknown;
	readonly headers?: Record<string, string>;
	readonly status?: number;
}

export interface Check {
	readonly conclusion: string | null;
	readonly name?: string;
	readonly required?: boolean;
	readonly status: string;
}

export interface CommitStatus {
	readonly required: boolean;
	readonly state: string;
}

export interface Pull {
	autoMerge: boolean;
	branch: string;
	mergeable: boolean | null;
	mergeableState: string;
	merged: boolean;
	sha: string;
	state: "open" | "closed";
	title: string;
}

export interface Received {
	readonly at: number;
	readonly authorization: string | undefined;
	readonly body: { readonly query?: string; readonly variables?: Record<string, unknown> } | undefined;
	readonly method: string;
	readonly path: string;
	readonly status: number;
}

interface GraphqlQuery {
	readonly query: string;
	readonly variables: { readonly after?: string | null; readonly number: number; readonly sha?: string };
}

export const REPOSITORY = "/repos/acme/project";
export const OPEN_LIST = "/pulls?state=open&per_page=100";
export const QUEUE_REFS = "/git/matching-refs/heads/gh-readonly-queue/";
export const GRAPHQL = "/graphql";
export const REQUIRED_CHECKS = "/graphql required checks";
const NEXT_REQUIRED_PAGE = "next";

export function checksRoute(sha: string) {
	return `/commits/${sha}/check-runs?per_page=100&filter=latest`;
}

export function statusRoute(sha: string) {
	return `/commits/${sha}/status`;
}

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

export function pullDetail(pull: Pull, number: number) {
	return {
		"auto_merge": pull.autoMerge ? { "merge_method": "squash" } : null,
		head: { ref: pull.branch, sha: pull.sha },
		mergeable: pull.mergeable,
		"mergeable_state": pull.mergeableState,
		merged: pull.merged,
		number,
		state: pull.state,
		title: pull.title,
	};
}

export async function startServer(now: () => number) {
	const directory = await mkdtemp(join(tmpdir(), "pr-watch-"));
	const pulls = new Map<number, Pull>();
	const open = new Set<number>();
	const queueRefs = new Set<number>();
	const queueEntries = new Set<number>();
	const dequeueReasons = new Map<number, string>();
	const statuses = new Map<string, CommitStatus>();
	const checks = new Map<string, readonly Check[]>();
	const checkRequired = new Map<string, boolean>();
	const requiredFlagsPaged = new Set<string>();
	const overrides = new Map<string, Reply>();
	const extraHeaders = new Map<string, Record<string, string>>();
	const requests: Received[] = [];

	function pullOf(number: number) {
		const pull = pulls.get(number);
		if (pull === undefined) {
			throw new Error(`Open PR ${number} on GitHub before changing it`);
		}
		return pull;
	}

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

	function checkRuns(prefix: string, runs: readonly Check[]) {
		return {
			"check_runs": runs.map(({ required = true, ...run }, index) => {
				const id = `${prefix}-${index}`;
				checkRequired.set(id, required);
				return { ...run, "node_id": id };
			}),
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

	const server = createServer(async (request, response) => {
		const chunks: Uint8Array[] = [];
		for await (const chunk of request) {
			chunks.push(chunk);
		}
		const text = Buffer.concat(chunks).toString();
		const body = text === "" ? undefined : JSON.parse(text);
		const path = request.url ?? "";
		const reply = replyTo(path, body);
		const etag = `"${JSON.stringify([reply.body, reply.headers?.link])
			.replaceAll('"', "")
			.replaceAll(/[^\x20-\x7e]/gu, "")}"`;
		const unchanged = reply.status === undefined && request.headers["if-none-match"] === etag;
		const status = reply.status ?? (unchanged ? HttpStatus.fromLiteral("NotModified") : HttpStatus.fromLiteral("OK"));
		requests.push({ at: now(), authorization: request.headers.authorization, body, method: request.method ?? "GET", path, status });
		response.writeHead(status, { "content-type": "application/json", etag, ...reply.headers });
		response.end(unchanged ? undefined : JSON.stringify(reply.body));
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("Expected a TCP address");
	}
	return {
		apiUrl: `http://127.0.0.1:${address.port}`,
		checkRuns,
		checks,
		close: async () => {
			server.closeAllConnections();
			await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
			await rm(directory, { force: true, recursive: true });
		},
		dequeueReasons,
		directory,
		extraHeaders,
		open,
		overrides,
		pullOf,
		pulls,
		queueEntries,
		queueRefs,
		requests,
		requiredFlagsPaged,
		statuses,
	};
}

export type FakeGitHub = Awaited<ReturnType<typeof startServer>>;
