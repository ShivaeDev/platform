import { Clock, Duration, Effect } from "effect";
import { withLive } from "@shivaedev/test/withLive.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { run } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { schedulerPause } from "#host/commands.ts";
import { resolveHost } from "#host/config.ts";
import { GithubApi } from "#host/githubApi.ts";
import { pace } from "#host/githubRateLimit.ts";
import { staticConfig } from "#host/liveConfig.ts";
import type { FleetRecord } from "#model.ts";
import { type EngineStory, newEngineState, running } from "#test/engineState.ts";
import { engineDefinition } from "#test/engineStory.ts";
import { engineVerbs } from "#test/engineVerbs.ts";
import { scheduledCodex } from "#test/scheduledCodex.ts";

interface ProviderReadStory extends EngineStory {
	scheduledProvider?: Effect.Success<ReturnType<typeof scheduledCodex>>;
	schedulerTimers: Set<number>;
}

export const providerRead = storyKit({
	...engineDefinition,
	around: withIsolatedDatabase,
	create: (): ProviderReadStory => ({ ...newEngineState(), schedulerTimers: new Set() }),
	inspect: (state: ProviderReadStory) => ({
		...engineDefinition.inspect(state),
		reads: state.scheduledProvider?.reads,
		timers: [...state.schedulerTimers],
	}),
	verbs: (state: ProviderReadStory, story) => ({
		...engineVerbs(state, story),
		awaitProviderReads: (count: number) =>
			withLive(
				Effect.gen(function* () {
					story.tell(`wait for Codex read ${count}`);
					while ((state.scheduledProvider?.reads.length ?? 0) < count) {
						yield* Effect.sleep("1 milli");
					}
				}).pipe(Effect.timeout("5 seconds")),
			),
		awaitRetryTimer: (retryAt: number) =>
			withLive(
				Effect.gen(function* () {
					story.tell(`wait for the scheduler's retry timer at ${retryAt}`);
					while (!state.schedulerTimers.has(retryAt)) {
						yield* Effect.sleep("1 milli");
					}
				}).pipe(Effect.timeout("5 seconds")),
			),
		providerReadTimes: () => [...(state.scheduledProvider?.reads ?? [])],
		startPacedScheduler: () =>
			Effect.gen(function* () {
				story.tell("start Fleet while GitHub is below its reserve until the next hour");
				const clock = yield* Clock.Clock;
				const reset = clock.currentTimeMillisUnsafe() + 3_600_000;
				const github = pacedGithub(clock, reset);
				return yield* Effect.scoped(run(schedulerPause)).pipe(
					Effect.provideService(Clock.Clock, timerClock(clock, state.schedulerTimers)),
					Effect.provideService(Fleet, running(state).fleet),
					Effect.provideService(GithubApi, github),
					Effect.provide(staticConfig(resolveHost("/synthetic", { intervalSeconds: 1, provider: "cloud" }))),
					Effect.forkChild,
				);
			}),
		waitForStoredRecord: (id: string, ready: (record: FleetRecord) => boolean) =>
			withLive(
				Effect.gen(function* () {
					story.tell(`wait for ${id}'s durable provider transition`);
					while (true) {
						const record = (yield* running(state).fleet.get(id)).value;
						state.lastRecord = record;
						if (ready(record)) {
							return record;
						}
						yield* Effect.sleep("1 milli");
					}
				}).pipe(Effect.timeout("5 seconds")),
			),
	}),
});

export function silentCodexReads(silent: boolean) {
	return providerRead.trait("configuration", silent ? "Codex never answers state reads" : "Codex drops its first state read", function* (state) {
		const clock = yield* Clock.Clock;
		const provider = yield* scheduledCodex(silent);
		state.scheduledProvider = provider;
		state.options = {
			...state.options,
			decorateTransport: (transport) => ({
				...transport,
				observe: (receipt) => (receipt.turnId === "turn-operation-1" ? provider.transport.observe(receipt) : transport.observe(receipt)),
			}),
			denyDelivery: true,
			now: () => clock.currentTimeMillisUnsafe(),
		};
	});
}

function pacedGithub(clock: Clock.Clock, reset: number) {
	const observation = {
		limit: 5000,
		limitedBy: "reserve" as const,
		limitedUntil: reset,
		observedAt: 0,
		remaining: 1,
		reset: reset / 1000,
		resource: "core",
		used: 4999,
	};
	return GithubApi.of({
		get: () => Effect.die("Unexpected GitHub request"),
		observations: () => Effect.succeed([]),
		pace: (interval) => Effect.sync(() => pace(observation, interval, clock.currentTimeMillisUnsafe())),
		pages: () => Effect.die("Unexpected GitHub request"),
	});
}

function timerClock(clock: Clock.Clock, timers: Set<number>): Clock.Clock {
	return {
		...clock,
		sleep: (duration) =>
			Effect.sync(() => timers.add(clock.currentTimeMillisUnsafe() + Duration.toMillis(duration))).pipe(Effect.andThen(clock.sleep(duration))),
	};
}
