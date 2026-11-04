import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, Console, Effect, FileSystem, Path, Schema } from "effect";
import { read } from "@shivaedev/github/read.ts";
import { ChangesetError } from "@shivaedev/releases/error.ts";
import { git } from "@shivaedev/releases/git.ts";
import { githubLayer } from "#lib/githubLayer.ts";
import { checkPlatform } from "#release/check.ts";

const Repository = Schema.Struct({ fullName: Schema.String }).pipe(Schema.encodeKeys({ fullName: "full_name" }));
const Pull = Schema.Struct({
	base: Schema.Struct({ ref: Schema.String, repo: Repository }),
	head: Schema.Struct({ ref: Schema.String, repo: Schema.NullOr(Repository) }),
	mergeCommitSha: Schema.NullOr(Schema.String),
	mergedAt: Schema.NullOr(Schema.String),
}).pipe(Schema.encodeKeys({ mergeCommitSha: "merge_commit_sha", mergedAt: "merged_at" }));

export const preparePublish = Effect.fn("Release.preparePublish")(function* (root: string, repository: string, main: string, before: string) {
	const commits = (yield* git(root, ["rev-list", `${before}..${main}`]))
		.trim()
		.split("\n")
		.filter((commit) => commit !== "");
	let mergedRelease = false;
	for (const commit of commits) {
		const pulls = yield* read(`/repos/${repository}/commits/${commit}/pulls`, Schema.Array(Pull));
		mergedRelease = pulls.some(
			(candidate) =>
				candidate.mergedAt !== null
				&& candidate.mergeCommitSha === commit
				&& candidate.base.ref === "main"
				&& candidate.base.repo.fullName === repository
				&& candidate.head.ref === "release/next"
				&& candidate.head.repo?.fullName === repository,
		);
		if (mergedRelease) {
			break;
		}
	}
	if (!mergedRelease) {
		return yield* new ChangesetError({ message: `Refusing to publish: push ${before}..${main} has no merged release/next PR.` });
	}
	yield* checkPlatform(root, before);
	return { base: before, head: main };
});

if (import.meta.main) {
	NodeRuntime.runMain(
		Effect.gen(function* () {
			const path = yield* Path.Path;
			const release = yield* preparePublish(
				path.resolve("."),
				yield* Config.String("GITHUB_REPOSITORY"),
				yield* Config.String("GITHUB_SHA"),
				yield* Config.String("CHANGELOG_BASE_REF"),
			);
			const fs = yield* FileSystem.FileSystem;
			yield* fs.writeFileString(yield* Config.String("GITHUB_OUTPUT"), `head=${release.head}\nbase=${release.base}\n`, { flag: "a" });
			yield* Console.log(`Publishing main head ${release.head} (base ${release.base}).`);
		}).pipe(Effect.provide(githubLayer), Effect.provide(NodeServices.layer)),
	);
}
