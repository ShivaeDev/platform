import process from "node:process";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Config, Effect, Schema } from "effect";
import { write } from "@shivaedev/github/GitHub.ts";
import { collectReleaseNotes } from "@shivaedev/releases/releaseNotes.ts";
import { githubLayer } from "#lib/githubLayer.ts";
import { checkPlatform } from "./check.ts";

export const publishNotes = Effect.fn("Release.publishNotes")(function* (root: string, repository: string, base: string, commit: string) {
	const plan = yield* checkPlatform(root, base);
	if (plan.releases.length === 0) {
		return;
	}
	yield* write(
		"POST",
		`/repos/${repository}/releases`,
		{
			body: yield* collectReleaseNotes(plan),
			name: `Release ${commit.slice(0, 7)}`,
			"tag_name": `release-${commit}`,
			"target_commitish": commit,
		},
		Schema.Struct({ id: Schema.Number }),
	);
});

if (import.meta.main) {
	NodeRuntime.runMain(
		Effect.gen(function* () {
			yield* publishNotes(
				process.cwd(),
				yield* Config.String("GITHUB_REPOSITORY"),
				yield* Config.String("CHANGELOG_BASE_REF"),
				yield* Config.String("GITHUB_SHA"),
			);
		}).pipe(Effect.provide(githubLayer), Effect.provide(NodeServices.layer)),
	);
}
