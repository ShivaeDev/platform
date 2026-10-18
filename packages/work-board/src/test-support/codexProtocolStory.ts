import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import process from "node:process";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
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
		cancelRead: () => {
			story.tell("the host cancels a pending provider read at its deadline");
			return codexRateLimits(() => child).pipe(Effect.timeout("50 millis"), Effect.result);
		},
		childKilled: () => child.killed,
	}),
});
