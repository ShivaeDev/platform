import { Option } from "effect";
import { boss } from "#test/boss.ts";
import { makePgBossTesting } from "#testing.ts";

export const acceleratedTesting = boss.trait("configuration", "a testing client observes the real queues", (state) => {
	state.testingState.enabled = true;
});

export const failingWorker = boss.trait("configuration", "a real worker fails every attempt", ({ testingState: state }) => {
	state.worker = true;
});

export const pausedWorker = boss.trait("configuration", "a real worker waits before completing", ({ testingState: state }) => {
	state.worker = true;
	state.paused = true;
});

export const productionRetries = boss.trait("configuration", "retry settings keep their production policy", ({ testingState: state }) => {
	state.testing = makePgBossTesting();
});

export const pendingExpiryRules = boss.trait("jobs", "pending jobs keep the expiry rule from their send", function* ({ testingState: state }) {
	const jobs = Option.getOrThrow(state.jobs);
	yield* jobs.enqueue(state.queue, { id: 11 }, { retryLimit: 0 });
	yield* state.testing.expireAfter(state.queue, 1);
	yield* jobs.enqueue(state.queue, { id: 12 });
	yield* state.testing.expireAfter(state.queue, 3);
	const id = Option.getOrThrow(yield* jobs.enqueue(state.queue, { id: 13 }));
	yield* state.testing.expireAfter(state.queue, 1);
	yield* jobs.enqueue(state.queue, { id: 13 }, { id });
});
