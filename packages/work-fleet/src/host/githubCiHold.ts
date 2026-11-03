import { Effect, Schema } from "effect";
import { Conflict, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { FilePages, githubJson } from "#host/github.ts";
import { GithubApi } from "#host/githubApi.ts";
import { readQueueState } from "#host/githubQueueStatus.ts";
import type { ChangeResult } from "#policy.ts";

const Pull = Schema.Struct({
	changedFiles: Schema.Number,
	head: Schema.Struct({ sha: Schema.String }),
	nodeId: Schema.String,
	state: Schema.String,
}).pipe(Schema.encodeKeys({ changedFiles: "changed_files", nodeId: "node_id" }));

export const githubCiHold = Effect.fn("FleetHost.githubCiHold")(function* (result: typeof ChangeResult.Type, approvedHead?: string) {
	const target = /^https:\/\/github\.com\/(?<repository>[^/]+\/[^/]+)\/pull\/(?<number>[1-9]\d*)$/u.exec(result.pr)?.groups;
	if (target === undefined) {
		return undefined;
	}
	const github = yield* GithubApi;
	const endpoint = `repos/${target.repository}/pulls/${target.number}`;
	const before = yield* githubJson(Pull, github.get(endpoint));
	if (before.state !== "open" || before.head.sha === approvedHead) {
		return undefined;
	}
	const files = (yield* githubJson(FilePages, github.pages(`${endpoint}/files?per_page=100`))).flat();
	const after = yield* githubJson(Pull, github.get(endpoint));
	if (before.head.sha !== after.head.sha || before.changedFiles !== after.changedFiles) {
		return yield* new Conflict({ message: "PR diff moved during CI change observation" });
	}
	if (files.length !== after.changedFiles) {
		return yield* new ServiceUnavailable({ message: "GitHub returned an incomplete changed-path observation" });
	}
	const paths = [...new Set(files.flatMap((file) => [file.filename, ...(file.previousFilename === undefined ? [] : [file.previousFilename])]))]
		.filter((path) => path.startsWith(".github/"))
		.sort((left, right) => left.localeCompare(right));
	if (paths.length === 0) {
		return undefined;
	}
	const queue = yield* readQueueState(after.nodeId);
	if (queue.mergeQueueEntry !== null) {
		yield* removeFromQueue("dequeuePullRequest", after.nodeId);
	}
	if (queue.autoMergeRequest !== null) {
		yield* removeFromQueue("disablePullRequestAutoMerge", after.nodeId);
	}
	return { head: after.head.sha, paths };
});

const removeFromQueue = Effect.fn("FleetHost.removeFromQueue")(function* (action: "dequeuePullRequest" | "disablePullRequestAutoMerge", pr: string) {
	const github = yield* GithubApi;
	const Response = Schema.Struct({ data: Schema.Struct({ [action]: Schema.Struct({ clientMutationId: Schema.NullOr(Schema.String) }) }) });
	yield* github
		.write({
			query: `mutation FleetHoldCi($pr: ID!) { ${action}(input: {pullRequestId: $pr}) { clientMutationId } }`,
			variables: { pr },
		})
		.pipe(
			Effect.flatMap(Schema.decodeUnknownEffect(Response)),
			Effect.mapError(() => new ServiceUnavailable({ message: "GitHub could not remove the CI-changing PR from automatic merging" })),
		);
});

export const requireCiApproval = Effect.fn("FleetHost.requireCiApproval")(function* (result: typeof ChangeResult.Type, approvedHead?: string) {
	const held = yield* githubCiHold(result, approvedHead);
	if (held !== undefined) {
		return yield* new Conflict({ message: `CI changes need orchestrator release: ${held.paths.join(", ")}` });
	}
});
