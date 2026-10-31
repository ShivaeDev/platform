import { Effect } from "effect";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import type { BoardWork, ChangeResult } from "#policy.ts";
import { httpGithubApi } from "#test/githubApi.ts";

export const mergeQueueApi = Effect.gen(function* () {
	const pulls = new Map<string, { result: typeof ChangeResult.Type; branch: string }>();
	const queued = new Map<string, string>();
	const removals = new Map<string, { reason: string; commit: string | undefined; createdAt: string }>();
	const checks = new Map<string, { name: string; conclusion: string | null; url: string }>();
	let loseReply = false;
	const overrides = new Map<string, Record<string, unknown>>();
	function observation(number: string) {
		const removal = removals.get(number);
		const nodes =
			removal === undefined
				? []
				: [
						{
							__typename: "RemovedFromMergeQueueEvent",
							beforeCommit: removal.commit === undefined ? null : { oid: removal.commit },
							createdAt: removal.createdAt,
							reason: removal.reason,
						},
					];
		return {
			autoMergeRequest: queued.has(number) ? { enabledAt: "2026-10-31T00:00:00Z" } : null,
			mergeQueueEntry: queued.has(number) ? { id: number } : null,
			state: "OPEN",
			timelineItems: { nodes },
			...overrides.get(number),
		};
	}
	function checkRuns(head: string) {
		const check = checks.get(head);
		return check === undefined
			? []
			: [
					{
						conclusion: check.conclusion,
						"details_url": check.url,
						"head_sha": head,
						"html_url": check.url,
						name: check.name,
						status: check.conclusion === null ? "in_progress" : "completed",
					},
				];
	}
	const server = yield* fakeHttpService({
		routes: {
			branch: {
				path: "/repos/example/project/branches/main",
				reply: () => ({ body: { protected: true, protection: { "required_status_checks": { contexts: ["verify"] } } } }),
			},
			checks: {
				path: "/repos/example/project/commits/:head/check-runs",
				reply: ({ params }) => ({ body: { "check_runs": checkRuns(params.head ?? "") } }),
			},
			pull: {
				method: "GET",
				path: "/repos/example/project/pulls/:number",
				reply: ({ params }) => {
					const number = params.number ?? "";
					const pull = pulls.get(number);
					if (pull === undefined) {
						return { status: 404 };
					}
					return {
						body: {
							"auto_merge": queued.has(number) ? {} : null,
							base: { ref: "main", sha: "main-revision" },
							head: { ref: pull.branch, repo: { "full_name": "example/project" }, sha: pull.result.head },
							labels: [],
							mergeable: true,
							"node_id": number,
							state: "open",
							title: "Land the requested work",
							...overrides.get(number),
						},
					};
				},
			},
			queue: {
				method: "POST",
				path: "/graphql",
				reply: ({ body }) => {
					const { query, variables } = JSON.parse(body.toString());
					if (query.includes("FleetQueueStatus")) {
						return { body: { data: { node: observation(variables.pr) } } };
					}
					queued.set(variables.pr, variables.head);
					if (loseReply) {
						loseReply = false;
						return { body: { message: "Accepted but reply lost" }, status: 503 };
					}
					return { body: { data: { enablePullRequestAutoMerge: { pullRequest: { id: variables.pr } } } } };
				},
			},
			rules: { path: "/repos/example/project/rules/branches/main", reply: () => ({ body: [] }) },
			statuses: { path: "/repos/example/project/commits/:head/status", reply: ({ params }) => ({ body: { sha: params.head, statuses: [] } }) },
		},
	});
	return {
		client: yield* httpGithubApi(server.url),
		dequeue: (number: string, reason: string, commit: string | undefined, at: number) => {
			queued.delete(number);
			removals.set(number, { commit, createdAt: new Date(at).toISOString(), reason });
		},
		loseReply: () => {
			loseReply = true;
		},
		mergeGroupCheck: (commit: string, check: { name: string; conclusion: string | null; url: string }) => checks.set(commit, check),
		observe: (work: BoardWork, result: typeof ChangeResult.Type) => {
			pulls.set(result.pr.split("/").at(-1) ?? "", { branch: `worker-${work.workId}`, result });
		},
		override: (number: string, fields: Record<string, unknown>) => overrides.set(number, fields),
		queued: () => [...queued.entries()],
		requests: () =>
			server.requests
				.filter((request) => request.method === "POST")
				.map((request) => JSON.parse(request.body.toString()))
				.filter((request) => request.query.includes("mutation")),
	};
});
