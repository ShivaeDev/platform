import { Context, Effect, Layer, Redacted } from "effect";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { batchBudget } from "#test/batchBudget.ts";
import { budgetVerbs } from "#test/budgetVerbs.ts";
import { clientEngine } from "#test/clientEngine.ts";
import { pgBossRuntime } from "#test/pgBossRuntime.ts";
import { postgresConfigured, postgresLayer } from "#test/postgresLayer.ts";
import { testingEngine } from "#test/testingEngine.ts";
import { testingProducer, testingVerbs, testingWorker } from "#test/testingProducer.ts";
import { tracingEngine } from "#test/tracingEngine.ts";
import { tracingVerbs } from "#test/tracingVerbs.ts";
import { waitingVerbs } from "#test/waitingVerbs.ts";

export const boss = storyKit({
	after: { producer: testingProducer, runtime: testingWorker },
	clock: "live",
	*create() {
		return { ...clientEngine(), budget: batchBudget(), testingState: yield* Effect.gen(testingEngine), trace: tracingEngine() };
	},
	inspect: (state) => ({
		attempts: state.testingState.attempts,
		failed: state.client.failCalls,
		jobs: state.testingState.readout,
		queues: [...state.client.queues],
		sent: state.client.sendCalls,
		settled: state.client.completeCalls,
	}),
	name: "pg-boss",
	run: {
		diagnose: (state) => JSON.stringify(state.testingState.readout),
		maxSteps: 100,
		*step(state) {
			const testing = state.testingState;
			yield* testing.testing.waitForChange(testing.revision);
			testing.revision = yield* testing.testing.revision;
			testing.readout = yield* testing.testing.jobs(testing.queue);
		},
	},
	stages: ["database", "client", "configuration", "producer", "jobs", "runtime"],
	verbs: (state, story) => {
		const runtime = pgBossRuntime(state, story.tell);
		return {
			...runtime,
			...waitingVerbs(),
			budgets: budgetVerbs(state.budget, runtime),
			traces: tracingVerbs(state.trace, runtime),
			...testingVerbs(state.testingState),
			settle: () =>
				story
					.runUntil(
						(current) =>
							current.testingState.readout.length > 0
							&& current.testingState.readout.every((job) => job.state === "completed" || job.state === "failed"),
					)
					.pipe(Effect.map(() => state.testingState.readout)),
		};
	},
});

export const postgresIt = boss.it.runIf(postgresConfigured);

export const realPostgres = boss.trait("database", "an isolated real PostgreSQL database", function* (state) {
	const services = yield* Layer.build(postgresLayer);
	const database = Context.get(services, PostgresTestDatabase);
	const isolated = yield* database.isolated;
	state.connectionString = Redacted.value(Context.get(isolated, PostgresTestDatabase).url);
	state.factory = undefined;
});

export const clientFailsStart = boss.trait("client", "the client cannot start", (state) => {
	state.client.failStart = true;
});
export const clientFailsQueue = boss.trait("client", "the client cannot create queues", (state) => {
	state.client.failCreateQueue = true;
});

export const retryTracedJob = boss.trait("configuration", "the traced worker fails its first attempt", (state) => {
	state.trace.failFirst = true;
});
