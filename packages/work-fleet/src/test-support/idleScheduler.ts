import { Clock, Context, Effect, Stream, SubscriptionRef } from "effect";
import { TestClock } from "effect/testing";
import { vi } from "vitest";
import { withLive } from "@shivaedev/test/withLive.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { SchedulerPasses } from "#engine/health.ts";
import { startScheduler } from "#engine/runScheduler.ts";
import { admitApproved } from "#host/admission.ts";
import { schedulerCadence } from "#host/commands.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { hostDefinition } from "#test/hostStory.ts";
import { hostVerbs } from "#test/hostVerbs.ts";

function nextPass(passes: SubscriptionRef.SubscriptionRef<number>, after: number) {
	return SubscriptionRef.changes(passes).pipe(
		Stream.filter((count) => count > after),
		Stream.take(1),
		Stream.runDrain,
	);
}

export function idleSchedulerVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	return {
		startIdleScheduler: () =>
			Effect.gen(function* () {
				tell("start Fleet admission and reconciliation on the test clock");
				const clock = yield* Clock.Clock;
				const calls = vi.spyOn(engine.fleet, "reconcile");
				yield* Effect.addFinalizer(() => Effect.sync(() => calls.mockRestore()));
				const workers = yield* startScheduler(schedulerCadence, admitApproved(engine.fixture.host).pipe(Effect.orDie, Effect.asVoid)).pipe(
					Effect.provideContext(engine.running.context),
					Effect.provideService(Clock.Clock, clock),
				);
				const passes = Context.get(engine.running.context, SchedulerPasses);
				const waiting = SubscriptionRef.changes(workers.admission.state).pipe(
					Stream.filter((state) => state.status === "waiting"),
					Stream.take(1),
					Stream.runDrain,
				);
				yield* waiting;
				return {
					elapseBeforeObservation: () => {
						tell("59 seconds pass without Board or database changes");
						return TestClock.adjust("59 seconds");
					},
					observationBecomesDue: () =>
						Effect.gen(function* () {
							tell("main and GitHub observation become due at 60 seconds");
							const before = yield* SubscriptionRef.get(passes);
							yield* TestClock.adjust("1 second");
							yield* nextPass(passes, before);
							yield* waiting;
						}),
					passes: () => SubscriptionRef.get(passes),
					reconciledWork: () => calls.mock.calls.map(([workId]) => workId),
				};
			}),
	};
}

export const idleHost = storyKit({
	...hostDefinition,
	after: { configuration: (engine: HostStoryEngine) => withLive(engine.deploy()) },
	clock: "test",
	verbs: (engine: HostStoryEngine, story) => ({ ...hostVerbs(engine, story.tell), ...idleSchedulerVerbs(engine, story.tell) }),
});
