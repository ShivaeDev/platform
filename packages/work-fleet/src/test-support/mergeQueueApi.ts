import { Effect } from "effect";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import type { BoardWork, ChangeResult } from "#policy.ts";
import { httpGithubApi } from "#test/githubApi.ts";

export const mergeQueueApi = Effect.gen(function* () {
	const pulls = new Map<string, { result: typeof ChangeResult.Type; branch: string }>();
	const queued = new Map<string, string>();
	let loseReply = false;
	const overrides = new Map<string, Record<string, unknown>>();
	const server = yield* fakeHttpService({
		routes: {
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
					const { variables } = JSON.parse(body.toString());
					queued.set(variables.pr, variables.head);
					if (loseReply) {
						loseReply = false;
						return { body: { message: "Accepted but reply lost" }, status: 503 };
					}
					return { body: { data: { enablePullRequestAutoMerge: { pullRequest: { id: variables.pr } } } } };
				},
			},
		},
	});
	return {
		client: yield* httpGithubApi(server.url),
		dequeue: (number: string) => queued.delete(number),
		loseReply: () => {
			loseReply = true;
		},
		observe: (work: BoardWork, result: typeof ChangeResult.Type) => {
			pulls.set(result.pr.split("/").at(-1) ?? "", { branch: `worker-${work.workId}`, result });
		},
		override: (number: string, fields: Record<string, unknown>) => overrides.set(number, fields),
		queued: () => [...queued.entries()],
		requests: () => server.requests.filter((request) => request.method === "POST").map((request) => JSON.parse(request.body.toString())),
	};
});
