import { Effect, Schema } from "effect";
import { BadRequest, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { conflictingPr, movedPrHead } from "#engine/deliveryFailure.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import type { FleetError } from "#errors.ts";
import type { GithubRead } from "#host/github.ts";
import { githubFailure } from "#host/githubRateLimit.ts";
import type { ChangeResult } from "#policy.ts";

const PullRequest = Schema.Struct({
	baseRefOid: Schema.optional(Schema.NonEmptyString),
	headRefOid: Schema.NonEmptyString,
	mergeable: Schema.optional(Schema.Literals(["MERGEABLE", "CONFLICTING", "UNKNOWN"])),
	mergeCommit: Schema.NullOr(Schema.Struct({ oid: Schema.NonEmptyString })),
	mergedAt: Schema.NullOr(Schema.NonEmptyString),
	state: Schema.Literals(["OPEN", "CLOSED", "MERGED"]),
	url: Schema.NonEmptyString,
});

function failure(message: string, reason: "integration" | "invalid" = "invalid") {
	return reason === "integration" ? new ServiceUnavailable({ message }) : new BadRequest({ message });
}

const Sha = Schema.String.check(Schema.isPattern(/^[a-f\d]{40}$/u));
const RestPullRequest = Schema.Struct({
	base: Schema.Struct({ sha: Sha }),
	head: Schema.Struct({ sha: Sha }),
	htmlUrl: Schema.NonEmptyString,
	mergeable: Schema.NullOr(Schema.Boolean),
	mergeCommitSha: Schema.NullOr(Schema.String),
	merged: Schema.Boolean,
	mergedAt: Schema.NullOr(Schema.NonEmptyString),
	state: Schema.Literals(["open", "closed"]),
}).pipe(Schema.encodeKeys({ htmlUrl: "html_url", mergeCommitSha: "merge_commit_sha", mergedAt: "merged_at" }));

function mergeability(mergeable: boolean | null) {
	if (mergeable === null) {
		return "UNKNOWN";
	}
	return mergeable ? "MERGEABLE" : "CONFLICTING";
}

function deliveryState(observed: typeof RestPullRequest.Type) {
	if (observed.merged) {
		return "MERGED";
	}
	return observed.state === "open" ? "OPEN" : "CLOSED";
}

export function readPullRequest(read: GithubRead["get"]) {
	return (pr: string) => {
		const match = /^https:\/\/github\.com\/(?<repository>[^/]+\/[^/]+)\/pull\/(?<number>[1-9]\d*)$/u.exec(pr)?.groups;
		return read(`repos/${match?.repository}/pulls/${match?.number}`).pipe(
			Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(RestPullRequest))),
			Effect.map((observed): typeof PullRequest.Encoded => ({
				baseRefOid: observed.base.sha,
				headRefOid: observed.head.sha,
				mergeable: mergeability(observed.mergeable),
				mergeCommit: observed.merged && observed.mergeCommitSha !== null ? { oid: observed.mergeCommitSha } : null,
				mergedAt: observed.mergedAt,
				state: deliveryState(observed),
				url: observed.htmlUrl,
			})),
			Effect.mapError(githubFailure("PR delivery observation failed; check GitHub CLI access and response")),
		);
	};
}

export function githubDelivery(read: (pr: string) => Effect.Effect<unknown, FleetError>) {
	return Effect.fn("FleetHost.githubDelivery")(function* (result: typeof ChangeResult.Type) {
		if (result.pr.match(/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/[1-9]\d*$/u) === null) {
			return yield* withFailureContext(new BadRequest({ message: "Delivery requires the adopted GitHub PR URL" }), { code: "delivery-pr-required" });
		}
		const pr = yield* Schema.decodeUnknownEffect(PullRequest)(yield* read(result.pr)).pipe(
			Effect.mapError(() => failure("PR delivery observation returned an unknown shape", "integration")),
		);
		yield* validateDelivery(pr, result);
		if (pr.state === "MERGED" && pr.mergedAt !== null && pr.mergeCommit !== null) {
			return { head: pr.headRefOid, revision: pr.mergeCommit.oid, url: pr.url };
		}
		if (pr.mergeable === "CONFLICTING" && pr.baseRefOid !== undefined) {
			return yield* conflictingPr(pr.baseRefOid);
		}
		return undefined;
	});
}

const validateDelivery = Effect.fn("FleetHost.validateDelivery")(function* (pr: typeof PullRequest.Type, result: typeof ChangeResult.Type) {
	if (pr.url !== result.pr) {
		return yield* failure("Delivery observation differs from the adopted PR");
	}
	if (pr.state === "CLOSED" && pr.mergedAt === null && pr.mergeCommit === null) {
		return yield* withFailureContext(failure("PR was closed without merging; inspect the closed PR before retrying or releasing this work"), {
			code: "pr-closed",
		});
	}
	const merged = pr.state === "MERGED" && pr.mergedAt !== null && pr.mergeCommit !== null;
	if (!merged && (pr.state !== "OPEN" || pr.mergedAt !== null || pr.mergeCommit !== null)) {
		return yield* failure("PR delivery evidence is inconsistent; inspect the adopted PR");
	}
	if (!merged && pr.headRefOid !== result.head) {
		return yield* movedPrHead(pr.headRefOid);
	}
});
