import { Effect, Schema } from "effect";
import { CheckPages, StatusPages } from "#host/githubCheckState.ts";
import { makeGithubChecks } from "#host/githubChecks.ts";
import { FleetFailure, type WorkResult } from "#policy.ts";

export const ADOPTED_HEAD = "a".repeat(40);
export const NEW_HEAD = "b".repeat(40);
export function githubResult(head = ADOPTED_HEAD): WorkResult {
	return { head, kind: "change", paths: ["src/one.ts"], pr: "https://github.com/example/project/pull/7" };
}

type CheckRun = (typeof CheckPages.Type)[number]["checkRuns"][number];
type Status = (typeof StatusPages.Type)[number]["statuses"][number];
export function checkRun(overrides: Partial<CheckRun> = {}): CheckRun {
	return {
		conclusion: "success",
		detailsUrl: "https://example.invalid/logs/test",
		headSha: ADOPTED_HEAD,
		htmlUrl: "https://example.invalid/check/test",
		name: "test",
		status: "completed",
		...overrides,
	};
}
export function commitStatus(overrides: Partial<Status> = {}): Status {
	return { context: "legacy", state: "success", targetUrl: "https://example.invalid/logs/legacy", ...overrides };
}
export function githubFixture() {
	const requests: string[] = [];
	const responses = new Map<string, string>();
	function reply(head: string, runs: readonly (readonly CheckRun[])[], statuses: readonly (readonly Status[])[] = [[]]) {
		const commit = `repos/example/project/commits/${head}`;
		responses.set(
			`${commit}/check-runs?per_page=100&filter=latest`,
			JSON.stringify(Schema.encodeSync(CheckPages)(runs.map((checkRuns) => ({ checkRuns })))),
		);
		responses.set(
			`${commit}/status?per_page=100`,
			JSON.stringify(Schema.encodeSync(StatusPages)(statuses.map((page) => ({ sha: head, statuses: page })))),
		);
	}
	function read(endpoint: string) {
		return Effect.suspend(() => {
			requests.push(endpoint);
			const response = responses.get(endpoint);
			return response === undefined
				? Effect.fail(new FleetFailure({ message: "Synthetic GitHub request failed", reason: "integration" }))
				: Effect.succeed(response);
		});
	}
	return { checks: makeGithubChecks(read), read, reply, requests, responses };
}
