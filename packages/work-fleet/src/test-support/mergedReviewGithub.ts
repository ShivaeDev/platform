import { createServer } from "node:http";
import { Effect } from "effect";
import { makeGithubChecks } from "#host/githubChecks.ts";
import { githubDelivery } from "#host/githubDelivery.ts";
import { githubResult } from "#host/githubResult.ts";
import { FleetFailure } from "#policy.ts";
import { BASE, HEAD, PR, resultFixture } from "#test/githubResult.ts";

interface GithubState {
	base: string;
	head: string;
	legacyResult: boolean;
	mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
	paths: string[];
	pending: boolean;
	status: "OPEN" | "CLOSED" | "MERGED";
}

function githubResponses(state: GithubState): Readonly<Record<string, unknown>> {
	const merged = state.status === "MERGED";
	return {
		"/repos/example/repository/pulls/7/files?per_page=100": [state.paths.map((filename) => ({ filename }))],
		"/repository": { nameWithOwner: "example/repository" },
		[`/repos/example/repository/commits/${state.head}/check-runs?per_page=100&filter=latest`]: [
			{
				"check_runs": [
					{
						conclusion: state.pending ? null : "success",
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
		"/delivery": {
			baseRefOid: state.base,
			headRefOid: state.head,
			mergeable: state.mergeable,
			mergeCommit: merged ? { oid: BASE } : null,
			mergedAt: merged ? "2026-01-01T00:00:00Z" : null,
			state: state.status,
			url: PR,
		},
		"/repos/example/repository/pulls/7": {
			base: { ref: "main", sha: BASE },
			"changed_files": state.paths.length,
			head: { sha: state.head },
			"html_url": PR,
			merged: state.status === "MERGED",
			number: 7,
			state: state.status === "OPEN" ? "open" : "closed",
		},
	};
}

export const mergedReviewGithub = Effect.fn("Test.mergedReviewGithub")(function* () {
	const state: GithubState = {
		base: BASE,
		head: HEAD,
		legacyResult: false,
		mergeable: "MERGEABLE",
		paths: ["src/one.ts"],
		pending: false,
		status: "OPEN",
	};
	const requests: string[] = [];
	const server = createServer((request, response) => {
		const path = request.url ?? "";
		requests.push(path);
		const body = githubResponses(state)[path];
		response.setHeader("Content-Type", "application/json");
		response.writeHead(body === undefined ? 404 : 200).end(JSON.stringify(body));
	});
	yield* Effect.promise(() => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)));
	yield* Effect.addFinalizer(() => Effect.promise(() => new Promise<void>((resolve) => server.close(() => resolve()))));
	const address = server.address();
	if (address === null || typeof address === "string") {
		return yield* Effect.die(new Error("No synthetic GitHub server address"));
	}
	const origin = `http://127.0.0.1:${address.port}`;
	function read(path: string) {
		return Effect.tryPromise({
			catch: () => new FleetFailure({ message: "Synthetic GitHub read failed", reason: "integration" }),
			try: async () => {
				const response = await fetch(`${origin}${path}`);
				if (!response.ok) {
					throw new Error("Unexpected synthetic GitHub request");
				}
				return response.text();
			},
		});
	}
	const { host, main } = resultFixture();
	const adopt = githubResult(host, main, (args) => read(args[0] === "repo" ? "/repository" : `/${args[1]}`));
	return {
		checksQuery: makeGithubChecks((endpoint) => read(`/${endpoint}`)),
		deliveryQuery: githubDelivery("/synthetic", () => read("/delivery").pipe(Effect.map((value): unknown => JSON.parse(value)))),
		requests,
		resultQuery: (...args: Parameters<typeof adopt>) =>
			adopt(...args).pipe(
				Effect.flatMap((result) =>
					state.legacyResult && state.status === "MERGED"
						? Effect.fail(new FleetFailure({ message: "Reported PR must be open and target the configured repository branch", reason: "invalid" }))
						: Effect.succeed(result),
				),
			),
		state,
	};
});
