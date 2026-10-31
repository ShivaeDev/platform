import { Effect, Schema } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { conflictingPr, movedPrHead } from "#engine/deliveryFailure.ts";
import type { FleetHost } from "#host/config.ts";
import { githubJson } from "#host/github.ts";
import { GithubApi } from "#host/githubApi.ts";
import { githubQueueStatus } from "#host/githubQueueStatus.ts";
import { githubReleaseWindow } from "#host/githubReleaseWindow.ts";
import type { BoardWork, ChangeResult } from "#policy.ts";

const PullRequest = Schema.Struct({
	base: Schema.Struct({ ref: Schema.String, sha: Schema.String }),
	head: Schema.Struct({
		ref: Schema.String,
		repo: Schema.Struct({ fullName: Schema.String }).pipe(Schema.encodeKeys({ fullName: "full_name" })),
		sha: Schema.String,
	}),
	labels: Schema.Array(Schema.Struct({ name: Schema.String })),
	mergeable: Schema.NullOr(Schema.Boolean),
	nodeId: Schema.String,
	title: Schema.String,
}).pipe(Schema.encodeKeys({ nodeId: "node_id" }));

const mutation = `mutation FleetQueue($pr: ID!, $head: GitObjectID!) {
	enablePullRequestAutoMerge(input: {pullRequestId: $pr, expectedHeadOid: $head, mergeMethod: SQUASH}) {
		pullRequest { id }
	}
}`;
const Response = Schema.Struct({
	data: Schema.Struct({ enablePullRequestAutoMerge: Schema.Struct({ pullRequest: Schema.Struct({ id: Schema.String }) }) }),
});

export function githubMergeQueue(host: FleetHost) {
	return Effect.fn("FleetHost.githubMergeQueue")(function* (work: BoardWork, result: typeof ChangeResult.Type, queued: boolean, queuedAt?: number) {
		const target = /^https:\/\/github\.com\/(?<repository>[^/]+\/[^/]+)\/pull\/(?<number>[1-9]\d*)$/u.exec(result.pr)?.groups;
		if (host.worker === undefined || target === undefined) {
			return "manual" as const;
		}
		const github = yield* GithubApi;
		const pr = yield* githubJson(PullRequest, github.get(`repos/${target.repository}/pulls/${target.number}`));
		if (humanMerge(pr, host, work.workId, target.repository ?? "")) {
			return "manual" as const;
		}
		if (pr.head.sha !== result.head) {
			return yield* movedPrHead(pr.head.sha);
		}
		if (pr.mergeable === false) {
			return yield* conflictingPr(pr.base.sha);
		}
		const status = yield* githubQueueStatus(pr.nodeId, result, host.repository.branch, queued, queuedAt);
		if (status !== undefined) {
			return status;
		}
		if (pr.mergeable === null) {
			return "pending" as const;
		}
		return (
			(yield* githubReleaseWindow(pr.head.repo.fullName, host.repository.branch, `repos/${target.repository}/pulls/${target.number}`, result))
			?? (yield* enableAutoMerge(pr.nodeId, result.head))
		);
	});
}

const enableAutoMerge = Effect.fn("FleetHost.enableAutoMerge")(function* (pr: string, head: string) {
	const github = yield* GithubApi;
	yield* github.write({ query: mutation, variables: { head, pr } }).pipe(
		Effect.flatMap(Schema.decodeUnknownEffect(Response)),
		Effect.mapError(() => new ServiceUnavailable({ message: "GitHub could not enable auto-merge for the reviewed head" })),
	);
	return "queued" as const;
});

function humanMerge(pr: typeof PullRequest.Type, host: FleetHost, workId: string, repository: string) {
	return (
		pr.head.ref !== `${host.worker?.branchPrefix}${workId}`
		|| pr.head.repo.fullName.toLowerCase() !== repository.toLowerCase()
		|| pr.base.ref !== host.repository.branch
		|| pr.head.ref.startsWith("release/")
		|| /^release(?:\b|\/)/iu.test(pr.title)
		|| pr.labels.some((label) => label.name === "release")
	);
}
