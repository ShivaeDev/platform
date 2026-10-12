import { Effect, Schema } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import type { FleetError } from "#errors.ts";
import { CheckPages, githubCheckState, StatusPages } from "#host/githubCheckState.ts";
import { githubRead } from "#host/githubRead.ts";
import type { WorkResult } from "#policy.ts";

function failure(message: string) {
	return new ServiceUnavailable({ message });
}

export function makeGithubChecks<R>(read: (endpoint: string) => Effect.Effect<string, FleetError, R>) {
	return Effect.fn("Fleet.githubChecks")(function* (result: WorkResult) {
		if (result.kind !== "change") {
			return yield* failure("GitHub checks need an adopted pull request");
		}
		const match = /^https:\/\/github\.com\/(?<owner>[A-Za-z0-9-]+)\/(?<repository>[A-Za-z0-9_.-]+)\/pull\/[1-9][0-9]*$/u.exec(result.pr);
		const owner = match?.groups?.owner;
		const repository = match?.groups?.repository;
		if (owner === undefined || repository === undefined || [".", ".."].includes(repository) || /^[0-9a-f]{40}$/u.exec(result.head) === null) {
			return yield* withFailureContext(
				new ServiceUnavailable({
					message: "GitHub checks need a GitHub pull request URL and an exact commit SHA",
				}),
				{ code: "checks-result-invalid" },
			);
		}
		const commit = `repos/${owner}/${repository}/commits/${result.head}`;
		const checks = yield* read(`${commit}/check-runs?per_page=100&filter=latest`).pipe(
			Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(CheckPages))),
			Effect.mapError(() => failure("GitHub check runs are unavailable or invalid")),
		);
		const statuses = yield* read(`${commit}/status?per_page=100`).pipe(
			Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(StatusPages))),
			Effect.mapError(() => failure("GitHub commit statuses are unavailable or invalid")),
		);
		if (
			statuses.length === 0
			|| checks.some((page) => page.checkRuns.some((check) => check.headSha !== result.head))
			|| statuses.some((page) => page.sha !== result.head)
		) {
			return yield* failure("GitHub checks returned evidence for a different commit SHA");
		}
		return githubCheckState(result.head, result.pr, checks, statuses);
	});
}

export const githubChecks = makeGithubChecks((endpoint) => githubRead(["api", "--method", "GET", "--paginate", "--slurp", endpoint]));
