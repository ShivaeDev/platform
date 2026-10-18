import { Effect, Stream } from "effect";
import { untilOutput } from "#test/follower.ts";
import { type FollowOptions, followerProcess } from "#test/followerProcess.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";

export function hostFollowerVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	function follower(name: string) {
		const value = engine.followers.get(name);
		if (value === undefined) {
			throw new Error(`Start follower ${name} before reading it`);
		}
		return value;
	}
	return {
		awaitOutput: (name: string, text: string) => untilOutput(follower(name), text),
		awaitSnapshot: () => Effect.promise(() => engine.subscribed).pipe(Effect.timeout("5 seconds")),
		follow: (name: string, command: "wait" | "watch", workIds: readonly string[], options: FollowOptions = {}) =>
			Effect.gen(function* () {
				if (engine.followers.has(name)) {
					return yield* Effect.die(`Follower ${name} already exists`);
				}
				tell(`start ${name}: ${command} ${workIds.join(", ")}`);
				const child = yield* followerProcess(engine.fixture.configFile, command, workIds, { port: engine.running.port, ...options });
				engine.followers.set(name, child);
			}),
		followerExit: (name: string) => Effect.promise(() => follower(name).done).pipe(Effect.timeout("10 seconds")),
		followerOutput: (name: string) => follower(name).output(),
		followerRunning: (name: string) => follower(name).isRunning(),
		snapshots: () => [...engine.snapshots],
		subscribe: (workIds: readonly string[]) =>
			Effect.gen(function* () {
				tell(`subscribe to daemon snapshots for ${workIds.join(", ")}`);
				const ready = Promise.withResolvers<void>();
				yield* engine.running.client("daemon.follow", { workIds }).pipe(
					Stream.tap((states) =>
						Effect.sync(() => {
							engine.snapshots.push(states);
							ready.resolve();
						}),
					),
					Stream.runDrain,
					Effect.forkScoped,
				);
				yield* Effect.promise(() => ready.promise).pipe(Effect.timeout("5 seconds"));
			}),
	};
}
