import { dirname } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { loadHost } from "#host/configFile.ts";
import { type Follower, type FollowOptions, followerProcess } from "#test/followerProcess.ts";
import { withReadDaemon } from "#test/readDaemon.ts";

export function withFollower<A, E, R>(
	configFile: string,
	command: "wait" | "watch",
	ids: readonly string[],
	options: FollowOptions,
	use: (follower: Follower) => Effect.Effect<A, E, R>,
) {
	const ready = Promise.withResolvers<void>();
	function run(port: number) {
		return Effect.scoped(
			followerProcess(configFile, command, ids, { ...options, port }, options.port === undefined ? ready.promise : Promise.resolve()).pipe(
				Effect.flatMap(use),
			),
		);
	}
	return options.port === undefined
		? loadHost(dirname(configFile), configFile).pipe(
				Effect.flatMap((host) => withReadDaemon(host, run, { onSnapshot: () => ready.resolve() })),
				Effect.provide(NodeServices.layer),
			)
		: run(options.port);
}

export const untilOutput = Effect.fn("FollowerTest.untilOutput")(function* (follower: Follower, text: string, timeoutMs?: number) {
	yield* untilText(follower.output, text, timeoutMs);
});

export const untilError = Effect.fn("FollowerTest.untilError")(function* (follower: Follower, text: string, offset = 0) {
	yield* untilText(() => follower.errors().slice(offset), text);
});

const untilText = Effect.fn("FollowerTest.untilText")(function* (output: () => string, text: string, timeoutMs = 10_000) {
	for (let attempt = 0; attempt < timeoutMs / 10; attempt += 1) {
		if (output().includes(text)) {
			return;
		}
		yield* Effect.sleep("10 millis");
	}
	return yield* Effect.die(new Error(`Follower did not print ${text}; got ${output()}`));
});

export function untilEveryOutput(followers: readonly Follower[], text: string) {
	return Effect.forEach(followers, (follower) => untilOutput(follower, text), { discard: true });
}
