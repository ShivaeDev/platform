import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, Effect, FileSystem, Path, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { ChangesetError } from "@shivaedev/releases/error.ts";
import { checkPlatform } from "#release/check.ts";
import { git } from "#release/git.ts";
import { preparePublish } from "#release/preparePublish.ts";
import { PublishedPackages } from "#release/publishedPackages.ts";

export const publishPackages = Effect.fn("Release.publishPackages")(function* (root: string, base: string) {
	const { packages } = yield* preparePublish(root, yield* git(root, "rev-parse", "HEAD"), base);
	if (packages.length === 0) {
		return [];
	}
	yield* checkPlatform(root, base);
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const status = yield* spawner.exitCode(
		ChildProcess.make(
			"pnpm",
			[...packages.flatMap(({ name }) => ["--filter", name]), "--recursive", "publish", "--no-git-checks", "--report-summary"],
			{
				cwd: root,
				stderr: "inherit",
				stdout: "inherit",
			},
		),
	);
	if (status !== 0) {
		return yield* new ChangesetError({ message: `Publishing the release failed with exit ${status}.` });
	}
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const summary = yield* fs.readFileString(path.join(root, "pnpm-publish-summary.json"));
	return (yield* Schema.decodeUnknownEffect(Schema.fromJsonString(PublishedPackages))(summary)).publishedPackages;
});

if (import.meta.main) {
	NodeRuntime.runMain(
		Effect.gen(function* () {
			const path = yield* Path.Path;
			yield* publishPackages(path.resolve("."), yield* Config.String("CHANGELOG_BASE_REF"));
		}).pipe(Effect.provide(NodeServices.layer)),
	);
}
