import { Effect } from "effect";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import type { BoardWork, ChangeResult } from "#policy.ts";
import { httpGithubApi } from "#test/githubApi.ts";
import { mergeQueueChecks } from "#test/mergeQueueChecks.ts";
import { releaseWindowApi } from "#test/releaseWindowApi.ts";

export const mergeQueueApi = Effect.gen(function* () {
	const pulls = new Map<string, { result: typeof ChangeResult.Type; branch: string }>();
	let base = "main-revision";
	let moveBase = false;
	const release = releaseWindowApi(
		(number) => pulls.get(number)?.result,
		() => {
			if (moveBase) {
				base = "advanced-main";
			}
		},
	);
	const queued = new Map<string, string>();
	const autoMerges = new Set<string>();
	const removals = new Map<string, { reason: string; commit: string | undefined; createdAt: string }>();
	const checks = mergeQueueChecks();
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
			autoMergeRequest: autoMerges.has(number) ? { enabledAt: "2026-10-31T00:00:00Z" } : null,
			mergeQueueEntry: queued.has(number) ? { id: number } : null,
			state: "OPEN",
			timelineItems: { nodes },
			...overrides.get(number),
		};
	}
	const server = yield* fakeHttpService({
		routes: {
			...release.routes,
			branch: {
				path: "/repos/example/project/branches/main",
				reply: () => ({ body: { protected: true, protection: { "required_status_checks": { contexts: ["verify"] } } } }),
			},
			checks: {
				path: "/repos/example/project/commits/:head/check-runs",
				reply: ({ params }) => ({ body: { "check_runs": checks.runs(params.head ?? "") } }),
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
							"auto_merge": autoMerges.has(number) ? {} : null,
							base: { ref: "main", sha: base },
							"changed_files": release.fileCount(pull.result.paths),
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
					if (query.includes("FleetHoldCi")) {
						const action = query.includes("dequeuePullRequest") ? "dequeuePullRequest" : "disablePullRequestAutoMerge";
						if (action === "dequeuePullRequest") {
							queued.delete(variables.pr);
						} else {
							autoMerges.delete(variables.pr);
						}
						return { body: { data: { [action]: { clientMutationId: null } } } };
					}
					queued.set(variables.pr, variables.head);
					autoMerges.add(variables.pr);
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
		...release,
		advanceMainDuringFiles: () => {
			moveBase = true;
		},
		autoMerges: () => [...autoMerges],
		client: yield* httpGithubApi(server.url),
		dequeue: (number: string, reason: string, commit: string | undefined, at: number) => {
			queued.delete(number);
			autoMerges.delete(number);
			removals.set(number, { commit, createdAt: new Date(at).toISOString(), reason });
		},
		loseReply: () => {
			loseReply = true;
		},
		mergeGroupCheck: checks.record,
		observe: (work: Pick<BoardWork, "workId">, result: typeof ChangeResult.Type) => {
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
