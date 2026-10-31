import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import process from "node:process";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { codexRateLimits } from "#server/diagnostics/codexRateLimits.ts";

export const codexProtocolStory = storyKit({
	clock: "live",
	*create() {
		const child = yield* Effect.acquireRelease(
			Effect.sync(() => spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "pipe" })),
			(acquired) =>
				Effect.sync(() => {
					acquired.kill();
				}),
		);
		return { child };
	},
	inspect: (engine) => ({ killed: engine.child.killed }),
	name: "board provider cancellation",
	stages: ["provider"],
	verbs: ({ child }: { child: ChildProcessWithoutNullStreams }, story) => ({
		hostCancelsAtDeadline: () => {
			story.tell("the host cancels a provider read that never answers at a 50 millisecond deadline");
			return codexRateLimits(() => child).pipe(
				Effect.timeout("50 millis"),
				Effect.match({ onFailure: () => "cancelled", onSuccess: () => "answered" }),
			);
		},
		providerProcess: () =>
			Effect.sync(() => {
				story.tell("the reader checks the provider's child process");
				return child.killed ? "killed" : "running";
			}),
	}),
});
