import { execFileSync } from "node:child_process";
import process from "node:process";
import { NodeFileSystem, NodeRuntime } from "@effect/platform-node";
import { Config, Console, Effect } from "effect";
import { applyRelease } from "@shivaedev/changesets/applyRelease.ts";
import config from "#release-config";
import { releaseGitHub } from "./gitHub.ts";
import { planPullRequest } from "./planPullRequest.ts";
import { releasePrSummary } from "./prSummary.ts";

export const maintainPullRequest = Effect.fn("Release.maintainPullRequest")(function* (root: string, github: ReturnType<typeof releaseGitHub>) {
	function git(...args: readonly string[]) {
		return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
	}
	const { pull, head } = github.snapshot();
	if (pull !== undefined && pull.mergeQueueEntry !== null) {
		return "queued";
	}
	git("switch", "-C", "release/next", "origin/main");
	const plan = yield* planPullRequest(root);
	if (plan.releases.length === 0) {
		if (pull !== undefined) {
			github.close(pull.number);
		}
		return "empty";
	}
	yield* applyRelease(root, config);
	git("add", "--all");
	const { title, body } = releasePrSummary(plan);
	git("commit", "-m", title);
	git("push", `--force-with-lease=refs/heads/release/next:${head}`, "origin", "HEAD:refs/heads/release/next");
	github.save(pull?.number, title, body);
	// GITHUB_TOKEN pushes and PR creation do not trigger pull_request CI.
	github.dispatch();
	return "updated";
});

if (import.meta.main) {
	NodeRuntime.runMain(
		Effect.gen(function* () {
			const repository = yield* Config.String("GITHUB_REPOSITORY");
			const result = yield* maintainPullRequest(process.cwd(), releaseGitHub(repository));
			yield* Console.log(`Release PR: ${result}`);
		}).pipe(Effect.provide(NodeFileSystem.layer)),
	);
}
