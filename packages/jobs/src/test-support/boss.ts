import { Context, Effect, Layer, Redacted } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { batchBudget } from "#test/batchBudget.ts";
import { budgetVerbs } from "#test/budgetVerbs.ts";
import { clientEngine } from "#test/clientEngine.ts";
import { connectionSecurity } from "#test/connectionSecurity.ts";
import { pgBossRuntime } from "#test/pgBossRuntime.ts";
import { postgresConfigured, postgresLayer } from "#test/postgresLayer.ts";
import { queueRetry } from "#test/queueRetry.ts";
import { scheduledTesting } from "#test/scheduledTesting.ts";
import { settlementProbe } from "#test/settlementProbe.ts";
import { testingEngine } from "#test/testingEngine.ts";
import { testingProducer, testingVerbs, testingWorker } from "#test/testingProducer.ts";
import { tracingEngine } from "#test/tracingEngine.ts";
import { tracingVerbs } from "#test/tracingVerbs.ts";
import { waitingVerbs } from "#test/waitingVerbs.ts";
import { workerRuntime } from "#test/workerRuntime.ts";

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
	stages: ["database", "client", "configuration", "producer", "jobs", "runtime"],
	verbs: (state, story) => {
		const runtime = pgBossRuntime(state, story.tell);
		return {
			...runtime,
			queueRetry: queueRetry(runtime),
			workerRuntime: workerRuntime(runtime),
			...connectionSecurity(state, runtime),
			...waitingVerbs(),
			budgets: budgetVerbs(state.budget, runtime),
			observeSettlement: settlementProbe,
			schedules: scheduledTesting(runtime),
			traces: tracingVerbs(state.trace, runtime),
			...testingVerbs(state.testingState),
			settle: () =>
				Effect.gen(function* () {
					const testing = state.testingState;
					yield* testing.testing.waitForIdle;
					testing.readout = yield* testing.testing.jobs(testing.queue);
					return testing.readout;
				}),
		};
	},
});

export const postgresIt = boss.it.runIf(postgresConfigured);

export const realPostgres = boss.trait("database", "an isolated real PostgreSQL database", function* (state) {
	const services = yield* Layer.build(postgresLayer);
	const database = Context.get(services, PostgresTestDatabase);
	const isolated = yield* database.isolated;
	state.connectionString = Redacted.value(Context.get(isolated, PostgresTestDatabase).url);
	state.sql = Context.get(isolated, SqlClient.SqlClient);
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

export const deferralWritesFail = boss.trait("client", "deferral writes are unavailable", (state) => {
	Object.assign(state.client, {
		getDb: () => ({
			executeSql: (text: string) => {
				if (text.includes("WITH claimed AS MATERIALIZED")) {
					return Promise.reject(new Error("deferral storage unavailable"));
				}
				return Promise.resolve({ rows: [] });
			},
		}),
	});
});
