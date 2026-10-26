import { Effect } from "effect";
import { type FakeHttpReply, fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { until } from "#test/cloudRestart.ts";

export const watchPrApi = Effect.gen(function* () {
	const replies = new Map<string, FakeHttpReply>();
	const github = {
		reply: (path: string, body: unknown, response: { status?: number } = {}) => replies.set(`/${path.replace(/^\//u, "")}`, { body, ...response }),
	};
	const server = yield* fakeHttpService({
		routes: {
			graphql: { method: "POST", path: "/graphql", reply: () => replies.get("/graphql") ?? { status: 404 } },
			rest: { path: "/:path*", reply: (request) => replies.get(request.path) ?? { status: 404 } },
		},
	});
	const repository = "example/repository";
	const base = `repos/${repository}`;
	let observations = 0;
	let pr: {
		"auto_merge": { "merge_method": string } | null;
		head: { ref: string; sha: string };
		mergeable: boolean;
		"mergeable_state": string;
		merged: boolean;
		number: number;
		state: string;
		title: string;
	} = {
		"auto_merge": { "merge_method": "squash" },
		head: { ref: "fleet/change", sha: "a".repeat(40) },
		mergeable: true,
		"mergeable_state": "clean",
		merged: false,
		number: 7,
		state: "open",
		title: "Ship the change",
	};
	function pull(changes: Partial<typeof pr>) {
		pr = { ...pr, ...changes };
		github.reply(`${base}/pulls/7`, pr);
	}
	function queue(queued: boolean, reason = "") {
		github.reply(`${base}/git/matching-refs/heads/gh-readonly-queue/`, queued ? [{ ref: "refs/heads/gh-readonly-queue/main/pr-7-head" }] : []);
		github.reply("/graphql", {
			data: {
				repository: {
					pullRequest: {
						autoMergeRequest: pr.auto_merge === null ? null : { enabledAt: "2026-01-01T00:00:00Z" },
						mergeQueueEntry: queued ? { id: "queue-entry" } : null,
						state: "OPEN",
						timelineItems: { nodes: reason ? [{ reason }] : [] },
					},
				},
			},
		});
	}
	pull({});
	queue(true);
	github.reply(`${base}/commits/${pr.head.sha}/check-runs?per_page=100&filter=latest`, { "check_runs": [] });
	github.reply(`${base}/commits/${pr.head.sha}/status`, { state: "success" });
	return {
		awaitPoll: () =>
			until(() =>
				Effect.sync(() => {
					const count = server.requests.filter((request) => request.path.endsWith("/status")).length;
					if (count <= observations) {
						return false;
					}
					observations = count;
					return true;
				}),
			),
		fail: (status: number) => github.reply(`${base}/pulls/7`, { message: "GitHub unavailable" }, { status }),
		pr: `https://github.com/${repository}/pull/7`,
		pull,
		queue,
		requests: () => server.requests.map(({ path, status }) => ({ path, status })),
		url: server.url,
	};
});
