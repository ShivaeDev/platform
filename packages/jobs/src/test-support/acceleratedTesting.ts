import { Option } from "effect";
import { defineQueue } from "#definition.ts";
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

export const stuckWorker = boss.trait(
	"configuration",
	"a real worker gets stuck on its first attempt with default worker options",
	({ testingState: state }) => {
		state.worker = true;
		state.stuck = Option.some("first");
		state.queue = defineQueue({ name: state.queue.name, queue: { ...state.queue.queueOptions, policy: "standard" }, schema: state.queue.schema });
	},
);

export const alwaysStuckWorker = boss.trait("configuration", "a real worker gets stuck on every attempt", ({ testingState: state }) => {
	state.stuck = Option.some("always");
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
