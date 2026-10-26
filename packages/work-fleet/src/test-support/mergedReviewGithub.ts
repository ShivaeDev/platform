import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { Effect } from "effect";
import { BadRequest } from "@shivaedev/platform/errors/taxonomy.ts";
import { makeGithubChecks } from "#host/githubChecks.ts";
import { githubDelivery, readPullRequest } from "#host/githubDelivery.ts";
import { githubPublication } from "#host/githubPublication.ts";
import { githubResult } from "#host/githubResult.ts";
import { httpGithubApi } from "#test/githubApi.ts";
import { BASE, HEAD, PR, resultFixture } from "#test/githubResult.ts";

interface GithubState {
	base: string;
	failed: boolean;
	head: string;
	legacyResult: boolean;
	mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
	paths: string[];
	pending: boolean;
	status: "OPEN" | "CLOSED" | "MERGED";
	unavailableReads: number;
}

function githubResponses(state: GithubState): Readonly<Record<string, unknown>> {
	const merged = state.status === "MERGED";
	const conclusion = state.failed ? "failure" : "success";
	return {
		"/repos/example/repository/git/matching-refs/heads/synthetic%2Fone": [{ ref: "refs/heads/synthetic/one" }],
		"/repos/example/repository/pulls?state=all&head=example%3Asynthetic%2Fone&per_page=100": [
			[{ "html_url": PR, "merged_at": merged ? "2026-01-01T00:00:00Z" : null, state: state.status === "OPEN" ? "open" : "closed" }],
		],
		"/repos/example/repository/pulls/7/files?per_page=100": [state.paths.map((filename) => ({ filename }))],
		"/repos/example/repository/rules/branches/main": [[]],
		[`/repos/example/repository/commits/${state.head}/check-runs?per_page=100&filter=latest`]: [
			{
				"check_runs": [
					{
						conclusion: state.pending ? null : conclusion,
						"details_url": null,
						"head_sha": state.head,
						"html_url": `${PR}/checks`,
						name: "test",
						status: state.pending ? "queued" : "completed",
					},
				],
			},
		],
		[`/repos/example/repository/commits/${state.head}/status?per_page=100`]: [{ sha: state.head, statuses: [] }],
		"/repos/example/repository/pulls/7": {
			base: { ref: "main", sha: state.base },
			"changed_files": state.paths.length,
			head: { sha: state.head },
			"html_url": PR,
			"merge_commit_sha": merged ? BASE : null,
			mergeable: state.mergeable === "UNKNOWN" ? null : state.mergeable === "MERGEABLE",
			merged,
			"merged_at": merged ? "2026-01-01T00:00:00Z" : null,
			number: 7,
			state: state.status === "OPEN" ? "open" : "closed",
		},
	};
}

export const mergedReviewGithub = Effect.fn("Test.mergedReviewGithub")(function* () {
	const state: GithubState = {
		base: BASE,
		failed: false,
		head: HEAD,
		legacyResult: false,
		mergeable: "MERGEABLE",
		paths: ["src/one.ts"],
		pending: false,
		status: "OPEN",
		unavailableReads: 0,
	};
	const requests: string[] = [];
	const conditionalHits: string[] = [];
	const server = createServer((request, response) => {
		const path = request.url ?? "";
		requests.push(path);
		if (state.unavailableReads > 0) {
			state.unavailableReads -= 1;
			response.writeHead(503).end();
			return;
		}
		const body = githubResponses(state)[path];
		const json = JSON.stringify(body);
		const etag = `"${createHash("sha256")
			.update(json ?? "")
			.digest("hex")}"`;
		response.setHeader("ETag", etag);
		if (body !== undefined && request.headers["if-none-match"] === etag) {
			conditionalHits.push(path);
			response.writeHead(304).end();
			return;
		}
		response.setHeader("Content-Type", "application/json");
		response.writeHead(body === undefined ? 404 : 200).end(json);
	});
	yield* Effect.promise(() => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)));
	yield* Effect.addFinalizer(() => Effect.promise(() => new Promise<void>((resolve) => server.close(() => resolve()))));
	const address = server.address();
	if (address === null || typeof address === "string") {
		return yield* Effect.die(new Error("No synthetic GitHub server address"));
	}
	const origin = `http://127.0.0.1:${address.port}`;
	const api = yield* httpGithubApi(origin);
	const { host } = resultFixture();
	const github = { get: api.get, pages: api.get };
	const adopt = githubResult(host, github, Effect.succeed("example/repository"));
	return {
		checksQuery: makeGithubChecks(github.pages),
		conditionalHits,
		deliveryQuery: githubDelivery(readPullRequest(github.get)),
		publication: githubPublication(
			{ ...host, worker: { branchPrefix: "synthetic/", sharedEnvironment: "/synthetic/env.sh" } },
			github,
			Effect.succeed("example/repository"),
		),
		requests,
		resultQuery: (...args: Parameters<typeof adopt>) =>
			adopt(...args).pipe(
				Effect.flatMap((result) =>
					state.legacyResult && state.status === "MERGED"
						? Effect.fail(new BadRequest({ message: "Reported PR must be open and target the configured repository branch" }))
						: Effect.succeed(result),
				),
			),
		state,
	};
});
