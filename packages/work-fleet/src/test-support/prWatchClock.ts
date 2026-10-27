import { NodeServices } from "@effect/platform-node";
import { Clock, ConfigProvider, Duration, Effect, FileSystem, Layer } from "effect";
import { TestClock } from "effect/testing";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { eventKinds } from "#host/watchEvents.ts";
import { watchPullRequests } from "#host/watchPullRequests.ts";
import { until } from "#test/cloudRestart.ts";
import { watchPrApi } from "#test/watchPrApi.ts";

export const prWatchClock = storyKit({
	clock: "live",
	*create() {
		const api = yield* watchPrApi;
		const interval = 60_000;
		const clock = pollClock(yield* TestClock.make(), interval);
		const lines: { readonly kind: string }[] = [];
		const watcher = yield* watchPullRequests(
			{
				apiUrl: api.url,
				board: yield* Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectoryScoped()),
				events: eventKinds,
				intervalMs: 500,
				prEvents: true,
				prIntervalMs: interval,
				stuckMs: 1_800_000,
				workIds: [],
			},
			(line) =>
				Effect.sync(() => {
					lines.push(line);
				}),
		);
		return { api, clock, lines, watcher };
	},
	inspect: (engine) => ({ lines: engine.lines, requests: engine.api.requests() }),
	layer: Layer.merge(NodeServices.layer, ConfigProvider.layer(ConfigProvider.fromEnvRecord({ "GH_TOKEN": "fleet-watch-test-token" }))),
	name: "Fleet PR watch clock",
	stages: ["observation"],
	verbs: (engine, story) => ({
		advance: (milliseconds: number) => {
			story.tell(`advance ${milliseconds} milliseconds`);
			return engine.clock.advance(milliseconds);
		},
		awaitPoll: () => {
			story.tell("await the next GitHub poll");
			return Effect.raceFirst(
				until(() => Effect.sync(engine.clock.sleeping)),
				engine.watcher.failed,
			);
		},
		conflict: () => engine.api.pull({ mergeable: false, "mergeable_state": "dirty" }),
		lines: () => engine.lines,
		start: () =>
			engine.watcher
				.update([{ result: { head: "a".repeat(40), pr: engine.api.pr }, stage: "working", workId: "one" }])
				.pipe(Effect.provideService(Clock.Clock, engine.clock.service)),
	}),
});

function pollClock(clock: TestClock.TestClock, interval: number) {
	let waiting = false;
	const service: Clock.Clock = {
		...clock,
		sleep(duration) {
			const pollWait = Duration.toMillis(duration) === interval;
			if (pollWait) {
				waiting = true;
			}
			return clock.sleep(duration).pipe(
				Effect.ensuring(
					Effect.sync(() => {
						if (pollWait) {
							waiting = false;
						}
					}),
				),
			);
		},
	};
	return {
		advance: (milliseconds: number) =>
			Effect.sync(() => {
				waiting = false;
			}).pipe(Effect.andThen(clock.adjust(milliseconds))),
		service,
		sleeping: () => waiting,
	};
}
