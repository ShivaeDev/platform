import { execFileSync, spawnSync } from "node:child_process";
import process from "node:process";
import { NodeFileSystem, NodeRuntime } from "@effect/platform-node";
import { Clock, Config, Console, Effect } from "effect";
import { applyRelease } from "@shivaedev/releases/applyRelease.ts";
import config from "#release-config";
import { compareRelease } from "./compare.ts";
import { releaseGitHub } from "./gitHub.ts";
import { planPullRequest } from "./planPullRequest.ts";
import { releasePrSummary } from "./prSummary.ts";

export const maintainPullRequest = Effect.fn("Release.maintainPullRequest")(function* (root: string, github: ReturnType<typeof releaseGitHub>) {
	function git(...args: readonly string[]) {
		return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
	}
	const { pull, head, hold } = github.snapshot();
	if (
		hold !== undefined
		&& (hold === "merge queue" || spawnSync("git", ["-C", root, "merge-tree", "--write-tree", "origin/main", head]).status === 0)
	) {
		return `held: ${hold}`;
	}
	git("switch", "-C", "release/next", "origin/main");
	const plan = yield* planPullRequest(root);
	if (plan.releases.length === 0) {
		if (pull !== undefined) {
			github.close(pull.number);
		}
		return "empty";
	}
	const comparison = yield* compareRelease(root, head);
	const clock = yield* Clock.Clock;
	// Reuse the standing release date for comparison so midnight alone cannot trigger a push.
	yield* applyRelease(root, config).pipe(
		Effect.provideService(Clock.Clock, {
			currentTimeMillis: comparison === undefined ? clock.currentTimeMillis : Effect.succeed(Date.parse(comparison.date)),
			currentTimeMillisUnsafe: () => clock.currentTimeMillisUnsafe(),
			currentTimeNanos: clock.currentTimeNanos,
			currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
			monotonicTimeNanos: clock.monotonicTimeNanos,
			monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
			sleep: (duration) => clock.sleep(duration),
		}),
	);
	git("add", "--all");
	const { title, body } = yield* releasePrSummary(plan);
	if (comparison?.base === git("rev-parse", "origin/main") && comparison.tree === git("write-tree")) {
		git("reset", "--hard", head);
		if (pull === undefined) {
			github.save(undefined, title, body);
		}
		return "unchanged";
	}
	if (comparison !== undefined) {
		git("reset", "--hard", "origin/main");
		yield* planPullRequest(root);
		yield* applyRelease(root, config);
		git("add", "--all");
	}
	git("commit", "-m", title);
	git("push", `--force-with-lease=refs/heads/release/next:${head}`, "origin", "HEAD:refs/heads/release/next");
	github.save(pull?.number, title, body);
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
