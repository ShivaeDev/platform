import { join } from "node:path";
import process from "node:process";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, Console, Effect, FileSystem, Schema } from "effect";
import { read } from "@shivaedev/github/GitHub.ts";
import { ChangesetError } from "@shivaedev/releases/error.ts";
import { git } from "@shivaedev/releases/git.ts";
import { readWorkspace } from "@shivaedev/releases/workspace.ts";
import { githubLayer } from "#lib/githubLayer.ts";
import config from "#release-config";
import { checkPlatform } from "./check.ts";

const Repository = Schema.Struct({ fullName: Schema.String }).pipe(Schema.encodeKeys({ fullName: "full_name" }));
const Pull = Schema.Struct({
	base: Schema.Struct({ ref: Schema.String, repo: Repository }),
	head: Schema.Struct({ ref: Schema.String, repo: Schema.NullOr(Repository), sha: Schema.String }),
	mergeCommitSha: Schema.NullOr(Schema.String),
	mergedAt: Schema.NullOr(Schema.String),
	number: Schema.Number,
}).pipe(Schema.encodeKeys({ mergeCommitSha: "merge_commit_sha", mergedAt: "merged_at" }));

export const preparePublish = Effect.fn("Release.preparePublish")(function* (root: string, repository: string, main: string, before: string) {
	const pulls = yield* read(`/repos/${repository}/commits/${main}/pulls`, Schema.Array(Pull));
	const pull = pulls.find(
		(candidate) =>
			candidate.mergedAt !== null
			&& candidate.mergeCommitSha === main
			&& candidate.base.ref === "main"
			&& candidate.base.repo.fullName === repository
			&& candidate.head.ref === "release/next"
			&& candidate.head.repo?.fullName === repository,
	);
	if (pull === undefined) {
		return yield* new ChangesetError({ message: `Refusing to publish: main commit ${main} is not a merged release/next PR.` });
	}
	const ref = `refs/pull/${pull.number}/head`;
	yield* git(root, ["fetch", "origin", ref]).pipe(
		Effect.mapError((cause) => new ChangesetError({ cause, message: `Refusing to publish: cannot fetch release PR head ${ref}.` })),
	);
	const head = (yield* git(root, ["rev-parse", "FETCH_HEAD"])).trim();
	if (head !== pull.head.sha) {
		return yield* new ChangesetError({ message: `Refusing to publish: ${ref} is ${head}, expected merged PR head ${pull.head.sha}.` });
	}
	const merged = yield* readWorkspace(root, config);
	yield* checkPlatform(root, before);
	yield* git(root, ["checkout", "--detach", head]);
	const frozen = yield* readWorkspace(root, config);
	for (const pkg of frozen.packages) {
		const version = merged.packages.find(({ manifest }) => manifest.name === pkg.manifest.name)?.manifest.version;
		if (version !== pkg.manifest.version) {
			return yield* new ChangesetError({
				message: `Refusing to publish: ${pkg.manifest.name} at release head is ${pkg.manifest.version}, but merged main records ${version ?? "no version"}.`,
			});
		}
	}
	const fs = yield* FileSystem.FileSystem;
	const base = (yield* fs.readFileString(join(root, ".changeset/release-base"))).trim();
	yield* checkPlatform(root, base);
	return { base, head };
});

if (import.meta.main) {
	NodeRuntime.runMain(
		Effect.gen(function* () {
			const release = yield* preparePublish(
				process.cwd(),
				yield* Config.String("GITHUB_REPOSITORY"),
				yield* Config.String("GITHUB_SHA"),
				yield* Config.String("CHANGELOG_BASE_REF"),
			);
			const fs = yield* FileSystem.FileSystem;
			yield* fs.writeFileString(yield* Config.String("GITHUB_OUTPUT"), `head=${release.head}\nbase=${release.base}\n`, { flag: "a" });
			yield* Console.log(`Publishing frozen release head ${release.head} (base ${release.base}).`);
		}).pipe(Effect.provide(githubLayer), Effect.provide(NodeServices.layer)),
	);
}
