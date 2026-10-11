import { Effect, Schema } from "effect";
import { readCommand } from "#host/readCommand.ts";
import { FleetFailure } from "#policy.ts";

const References = Schema.Array(Schema.Array(Schema.Struct({ ref: Schema.String })));
const PullRequests = Schema.Array(Schema.Array(Schema.Struct({ htmlUrl: Schema.String }).pipe(Schema.encodeKeys({ htmlUrl: "html_url" }))));

export function makeReportPublication<R>(read: (endpoint: string) => Effect.Effect<string, FleetFailure, R>) {
	return Effect.fn("Fleet.reportPublication")(
		function* (repository: string, branch: string) {
			const refs = yield* read(`repos/${repository}/git/matching-refs/heads/${encodeURIComponent(branch)}`).pipe(
				Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(References))),
			);
			const prs = yield* read(
				`repos/${repository}/pulls?state=all&head=${encodeURIComponent(`${repository.split("/")[0]}:${branch}`)}&per_page=100`,
			).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(PullRequests))));
			return refs.flat().some((ref) => ref.ref === `refs/heads/${branch}`) || prs.flat().length > 0;
		},
		Effect.mapError(() => new FleetFailure({ message: "Report publication could not be checked on GitHub", reason: "integration" })),
	);
}

export const reportPublication = makeReportPublication((endpoint) =>
	readCommand("gh", ["api", "--method", "GET", "--paginate", "--slurp", endpoint]),
);

export const reportRepository = Effect.fn("Fleet.reportRepository")(function* (cwd: string, remote: string) {
	const url = (yield* readCommand("git", ["remote", "get-url", remote], cwd)).trim();
	const repository = /^(?:https:\/\/github\.com\/|git@github\.com:)(?<repository>[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/u.exec(url)?.groups
		?.repository;
	if (repository === undefined) {
		return yield* Effect.fail(new FleetFailure({ message: "Report publication checks need a GitHub remote", reason: "integration" }));
	}
	return repository;
});
