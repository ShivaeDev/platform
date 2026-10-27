import { Effect, Schema } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { CheckPages, StatusPages } from "#host/githubCheckState.ts";
import { makeGithubChecks } from "#host/githubChecks.ts";
import type { WorkResult } from "#policy.ts";

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
export function githubFixture(repository = "example/project", branch = "main") {
	const requests: string[] = [];
	const responses = new Map<string, string>();
	function required(names: readonly string[]) {
		responses.set(
			`repos/${repository}/rules/branches/${encodeURIComponent(branch)}`,
			JSON.stringify([
				names.length === 0
					? []
					: [{ parameters: { "required_status_checks": names.map((context) => ({ context })) }, type: "required_status_checks" }],
			]),
		);
	}
	required([]);
	function reply(head: string, runs: readonly (readonly CheckRun[])[], statuses: readonly (readonly Status[])[] = [[]]) {
		const commit = `repos/${repository}/commits/${head}`;
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
			return response === undefined ? Effect.fail(new ServiceUnavailable({ message: "Synthetic GitHub request failed" })) : Effect.succeed(response);
		});
	}
	return { checks: makeGithubChecks(read, branch), read, reply, requests, required, responses };
}
