import { Effect, Schema } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import type { FleetError } from "#errors.ts";
import type { FleetHost } from "#host/config.ts";
import { type GithubRead, githubJson } from "#host/github.ts";
import type { BoardWork } from "#policy.ts";

const References = Schema.Array(Schema.Struct({ ref: Schema.String }));
const PullRequests = Schema.Array(
	Schema.Array(
		Schema.Struct({ htmlUrl: Schema.String, mergedAt: Schema.NullOr(Schema.String), state: Schema.Literals(["open", "closed"]) }).pipe(
			Schema.encodeKeys({ htmlUrl: "html_url", mergedAt: "merged_at" }),
		),
	),
);

export function githubPublication(host: FleetHost, read: GithubRead, repository: Effect.Effect<string, FleetError>) {
	return Effect.fn("FleetHost.githubPublication")(function* (work: BoardWork) {
		if (host.worker === undefined) {
			return yield* new ServiceUnavailable({ message: "Worker branch naming is not configured; cannot inspect published work" });
		}
		const repo = yield* repository;
		const branch = `${host.worker.branchPrefix}${work.workId}`;
		const refs = yield* githubJson(References, read.get(`repos/${repo}/git/matching-refs/heads/${encodeURIComponent(branch)}`)).pipe(Effect.result);
		const head = encodeURIComponent(`${repo.split("/")[0]}:${branch}`);
		const pulls = yield* githubJson(PullRequests, read.pages(`repos/${repo}/pulls?state=all&head=${head}&per_page=100`)).pipe(Effect.result);
		const remoteBranch = refs._tag === "Success" && refs.success.some((ref) => ref.ref === `refs/heads/${branch}`);
		const prs = pulls._tag === "Success" ? pulls.success.flat() : [];
		if (prs.length > 1) {
			return yield* new ServiceUnavailable({ message: `Several PRs use ${branch}; cannot select published work` });
		}
		const published = remoteBranch || prs.length > 0;
		if (!published && refs._tag === "Failure") {
			return yield* refs.failure;
		}
		if (!published && pulls._tag === "Failure") {
			return yield* pulls.failure;
		}
		return { branch, pullRequest: prs[0]?.htmlUrl, pullRequestState: publicationState(prs[0]), remoteBranch };
	});
}

function publicationState(pr: { readonly state: "open" | "closed"; readonly mergedAt: string | null } | undefined) {
	if (pr === undefined) {
		return undefined;
	}
	return pr.mergedAt === null ? pr.state : ("merged" as const);
}
