import { Context, Effect, Layer, Sink, Stream } from "effect";
import { ChildProcessSpawner } from "effect/unstable/process";
import { makeEffectIt } from "@shivaedev/effect-test";
import type { WorkSpec } from "#domain.ts";
import { GitHubLive } from "#GitHubLive.ts";
export const revision = "a".repeat(40);
export const work: WorkSpec = {
	baseBranch: "main",
	checkout: "/synthetic/repository",
	completion: "merged",
	id: "example",
	instructions: "Add a feature",
	pullRequest: {
		body: "## Why?\n\nUsers need to retain unfinished work.\n\n## How?\n\nSave draft content before publishing.",
		title: "Users can save a draft",
	},
	repository: "example/project",
	requiredChecks: ["test"],
	scope: [{ key: null, path: "src" }],
};
export const pullRequest = {
	baseRefName: "main",
	baseRefOid: "b".repeat(40),
	headRefOid: revision,
	isDraft: false,
	mergeable: "MERGEABLE",
	mergeStateStatus: "CLEAN",
	number: 12,
	state: "OPEN",
	statusCheckRollup: [{ __typename: "CheckRun", conclusion: "SUCCESS", detailsUrl: "https://example.com/check", name: "test", status: "COMPLETED" }],
	url: "https://github.com/example/project/pull/12",
};
export const published = {
	baseRefName: "main",
	headRefName: "work-fleet/example",
	headRefOid: revision,
	isCrossRepository: false,
	number: 12,
	state: "OPEN",
	url: pullRequest.url,
};
class GitHubTest extends Context.Service<
	GitHubTest,
	{
		readonly name: string;
	}
>()("work-fleet/test/github") {}
export const { effectApp } = makeEffectIt({ layer: Layer.succeed(GitHubTest, { name: "github" }), makeHarness: () => Effect.void });
export function scriptedGitHub(
	outputs: ReadonlyArray<
		| string
		| {
				readonly output: string;
				readonly code: number;
		  }
	>,
) {
	const calls: Array<{
		readonly command: string;
		readonly args: ReadonlyArray<string>;
	}> = [];
	const spawner = ChildProcessSpawner.make((command) =>
		Effect.sync(() => {
			if (command._tag !== "StandardCommand") {
				throw new Error("Unexpected command pipeline");
			}
			const response = outputs[calls.length];
			if (response === undefined) {
				throw new Error("Unexpected command after script end");
			}
			calls.push({ args: command.args, command: command.command });
			const output = typeof response === "string" ? response : response.output;
			const code = typeof response === "string" ? 0 : response.code;
			return ChildProcessSpawner.makeHandle({
				all: Stream.empty,
				exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(code)),
				getInputFd: () => Sink.drain,
				getOutputFd: () => Stream.empty,
				isRunning: Effect.succeed(false),
				kill: () => Effect.void,
				pid: ChildProcessSpawner.ProcessId(100),
				stderr: Stream.empty,
				stdin: Sink.drain,
				stdout: Stream.make(new TextEncoder().encode(output)),
				unref: Effect.succeed(Effect.void),
			});
		}),
	);
	return { calls, layer: GitHubLive().pipe(Layer.provide(Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner))) };
}
export const SAFE_CONFIG =
	"core.repositoryformatversion\n0\0core.bare\nfalse\0remote.origin.url\nhttps://github.com/example/project.git\0remote.origin.fetch\n+refs/heads/*:refs/remotes/origin/*\0";
export function checkoutResponses(paths = "src/feature.ts\0") {
	return [SAFE_CONFIG, "", `${revision}\n`, "", "https://github.com/example/project.git\n", "git@github.com:example/project.git\n", "", paths];
}
