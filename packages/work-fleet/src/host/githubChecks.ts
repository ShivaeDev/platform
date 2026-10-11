import { Effect, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { CheckPages, githubCheckState, StatusPages } from "#host/githubCheckState.ts";
import { FleetFailure, type WorkResult } from "#policy.ts";

function failure(message: string) {
	return new FleetFailure({ message, reason: "integration" });
}
const githubRead = Effect.fn("Fleet.githubRead")(function* (endpoint: string) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const process = yield* spawner.spawn(ChildProcess.make("gh", ["api", "--method", "GET", "--paginate", "--slurp", endpoint]));
			const output = yield* process.stdout.pipe(Stream.decodeText, Stream.mkString);
			if ((yield* process.exitCode) !== 0) {
				return yield* failure(`GitHub request failed: ${endpoint}`);
			}
			return output;
		}),
	).pipe(
		Effect.timeout("60 seconds"),
		Effect.mapError(() => failure(`GitHub checks could not be read from ${endpoint}; check gh authentication and repository access`)),
	);
});

export function makeGithubChecks<R>(read: (endpoint: string) => Effect.Effect<string, FleetFailure, R>) {
	return Effect.fn("Fleet.githubChecks")(function* (result: WorkResult) {
		if (result.kind !== "change") {
			return yield* failure("GitHub checks need an adopted pull request");
		}
		const match = /^https:\/\/github\.com\/(?<owner>[A-Za-z0-9-]+)\/(?<repository>[A-Za-z0-9_.-]+)\/pull\/[1-9][0-9]*$/u.exec(result.pr);
		const owner = match?.groups?.owner;
		const repository = match?.groups?.repository;
		if (owner === undefined || repository === undefined || [".", ".."].includes(repository) || /^[0-9a-f]{40}$/u.exec(result.head) === null) {
			return yield* failure("GitHub checks need a GitHub pull request URL and an exact commit SHA");
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

export const githubChecks = makeGithubChecks(githubRead);
