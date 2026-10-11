import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Schema } from "effect";
import { githubRead } from "#host/githubRead.ts";
import { type ChangeResult, FleetFailure } from "#policy.ts";

const PullRequest = Schema.Struct({
	headRefOid: Schema.NonEmptyString,
	mergeCommit: Schema.NullOr(Schema.Struct({ oid: Schema.NonEmptyString })),
	mergedAt: Schema.NullOr(Schema.NonEmptyString),
	state: Schema.Literals(["OPEN", "CLOSED", "MERGED"]),
	url: Schema.NonEmptyString,
});

function failure(message: string, reason: "integration" | "invalid" = "invalid") {
	return new FleetFailure({ message, reason });
}

function readPullRequest(cwd: string, pr: string) {
	return githubRead(["pr", "view", pr, "--json", "url,state,headRefOid,mergedAt,mergeCommit"], cwd).pipe(
		Effect.provide(NodeServices.layer),
		Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))),
		Effect.mapError(() => failure("PR delivery observation failed; check GitHub CLI access and response", "integration")),
	);
}

export function githubDelivery(cwd: string, read: (cwd: string, pr: string) => Effect.Effect<unknown, FleetFailure> = readPullRequest) {
	return Effect.fn("FleetHost.githubDelivery")(function* (result: typeof ChangeResult.Type) {
		if (result.pr.match(/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/[1-9]\d*$/u) === null) {
			return yield* failure("Delivery requires the adopted GitHub PR URL");
		}
		const pr = yield* Schema.decodeUnknownEffect(PullRequest)(yield* read(cwd, result.pr)).pipe(
			Effect.mapError(() => failure("PR delivery observation returned an unknown shape", "integration")),
		);
		if (pr.url !== result.pr) {
			return yield* failure("Delivery observation differs from the adopted PR");
		}
		if (pr.state === "CLOSED" && pr.mergedAt === null && pr.mergeCommit === null) {
			return yield* failure("PR was closed without merging; inspect the closed PR before retrying or releasing this work");
		}
		if (pr.headRefOid !== result.head) {
			return yield* failure("PR head differs from the reviewed head; review the current revision before accepting delivery");
		}
		if (pr.state === "MERGED" && pr.mergedAt !== null && pr.mergeCommit !== null) {
			return { head: pr.headRefOid, revision: pr.mergeCommit.oid, url: pr.url };
		}
		if (pr.state !== "OPEN" || pr.mergedAt !== null || pr.mergeCommit !== null) {
			return yield* failure("PR delivery evidence is inconsistent; inspect the adopted PR");
		}
		return undefined;
	});
}
