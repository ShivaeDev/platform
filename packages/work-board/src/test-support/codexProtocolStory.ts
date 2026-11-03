import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import process from "node:process";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import { codexRateLimits } from "#server/diagnostics/codexRateLimits.ts";

export const codexProtocolStory = storyKit({
	clock: "test",
	*create() {
		const child = yield* Effect.acquireRelease(
			Effect.sync(() => spawn(process.execPath, ["-e", "process.stdin.resume()"], { stdio: "pipe" })),
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
		hostCancelsAtDeadline: () =>
			Effect.gen(function* () {
				story.tell("the host cancels a provider read that never answers at a 50 millisecond deadline");
				const read = yield* codexRateLimits(() => child).pipe(
					Effect.timeout("50 millis"),
					Effect.catchTag("TimeoutError", () => Effect.succeed("cancelled")),
					Effect.forkChild,
				);
				yield* untilTimer("50 millis");
				yield* TestClock.adjust("50 millis");
				return yield* Fiber.join(read);
			}),
		providerProcess: () =>
			Effect.sync(() => {
				story.tell("the reader checks the provider's child process");
				return child.killed ? "killed" : "running";
			}),
	}),
});
