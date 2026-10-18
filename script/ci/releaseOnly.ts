import { execFileSync } from "node:child_process";
import { join } from "node:path";
import process from "node:process";
import { NodeFileSystem, NodeRuntime } from "@effect/platform-node";
import { Cause, Clock, Config, Console, Effect, FileSystem, Schema } from "effect";
import { applyRelease } from "@shivaedev/changesets/applyRelease.ts";
import { ReleaseManifest } from "@shivaedev/changesets/model.ts";
import { planPullRequest } from "#release/planPullRequest.ts";
import config from "#release-config";

export const releaseOnly = Effect.fn("CI.releaseOnly")(function* (root: string, base: string, head = "HEAD") {
	function git(...args: readonly string[]) {
		return Effect.try(() => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" }).trim());
	}
	return yield* Effect.gen(function* () {
		const manifest = yield* Effect.try(() =>
			Schema.decodeUnknownSync(Schema.fromJsonString(ReleaseManifest))(
				execFileSync("git", ["-C", root, "show", `${head}:.changeset/release.json`], { encoding: "utf8", stdio: "pipe" }),
			),
		);
		const fs = yield* FileSystem.FileSystem;
		const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "ci-release-" });
		const expected = join(temporary, "expected");
		yield* Effect.acquireRelease(git("worktree", "add", "--detach", expected, base), () =>
			git("worktree", "remove", "--force", expected).pipe(Effect.orDie),
		);
		const plan = yield* planPullRequest(expected);
		if (plan.releases.length === 0) {
			return false;
		}
		// A release remains eligible after midnight; reproduce its recorded date.
		const clock = yield* Clock.Clock;
		yield* applyRelease(expected, config).pipe(
			Effect.provideService(Clock.Clock, {
				currentTimeMillis: Effect.succeed(Date.parse(manifest.date)),
				currentTimeMillisUnsafe: () => Date.parse(manifest.date),
				currentTimeNanos: clock.currentTimeNanos,
				currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
				monotonicTimeNanos: clock.monotonicTimeNanos,
				monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
				sleep: (duration) => clock.sleep(duration),
			}),
		);
		yield* git("-C", expected, "add", "--all");
		const tree = yield* git("-C", expected, "write-tree");
		return tree === (yield* git("rev-parse", `${head}^{tree}`));
	}).pipe(
		Effect.scoped,
		Effect.catchCause((cause) => Console.log(`Release reproduction failed; use full CI: ${Cause.pretty(cause)}`).pipe(Effect.as(false))),
	);
});

if (import.meta.main) {
	NodeRuntime.runMain(
		Effect.gen(function* () {
			const base = process.argv[2];
			if (base === undefined) {
				return yield* Effect.fail(new Error("Pass the checked release base revision."));
			}
			const only = yield* releaseOnly(process.cwd(), base);
			yield* Console.log(`Release-only diff: ${only}`);
			const output = yield* Config.String("GITHUB_OUTPUT").pipe(Config.withDefault(undefined));
			if (output !== undefined) {
				yield* (yield* FileSystem.FileSystem).writeFileString(output, `release-only=${only}\n`, { flag: "a" });
			}
		}).pipe(Effect.provide(NodeFileSystem.layer)),
	);
}
