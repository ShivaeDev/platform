import { execFileSync } from "node:child_process";
import { Effect } from "effect";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { fixedMainSource } from "#test/mainSource.ts";

export function configurePublishedBranch(engine: HostStoryEngine) {
	engine.config = { ...engine.config, worker: { branchPrefix: "synthetic/", sharedEnvironment: "/synthetic/env.sh" } };
	engine.beforeStart = (fixture) =>
		Effect.sync(() => {
			const root = fixture.host.boardDir;
			function git(...args: string[]) {
				return execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
			}
			git("init", "--quiet", "--initial-branch=main");
			git(
				"-c",
				"user.name=Synthetic Worker",
				"-c",
				"user.email=worker@example.invalid",
				"commit",
				"--quiet",
				"--allow-empty",
				"-m",
				"Synthetic work",
			);
			git("branch", "synthetic/one");
			engine.parts = { ...engine.parts, main: fixedMainSource({ repositoryRoot: root }) };
		});
}

export function publicationReadouts(engine: HostStoryEngine) {
	return {
		githubMutations: () => {
			if (engine.pullRequest === undefined) {
				throw new Error("Configure a published pull request first");
			}
			return [...engine.pullRequest.mutations];
		},
		workerBranchHead: () =>
			execFileSync("git", ["-C", engine.fixture.host.boardDir, "rev-parse", "refs/heads/synthetic/one"], { encoding: "utf8" }).trim(),
	};
}
