import { Context, Effect, Layer, Option, Queue, Schema } from "effect";
import { TestClock } from "effect/testing";
import { makePgBossTesting, type PgBossTesting } from "@shivaedev/test-kits/jobs/testing.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { defineQueue } from "#server/definition.ts";
import { JobsClientFactory } from "#server/JobsClientFactory.ts";
import { makePgBoss, type PgBossService, pgBossLayer } from "#server/service.ts";
import { failureOf } from "#test/failureOf.ts";
import { postgresConfigured, postgresLayer } from "#test/postgres/layer.ts";

const Worker = makePgBoss("@test/ClockedWorker");
const Producer = makePgBoss("@test/ClockedProducer");
const OutsideProducer = makePgBoss("@test/OutsideProducer");
const Work = defineQueue({
	name: "clocked-work",
	schema: Schema.Struct({ message: Schema.String }),
	worker: { pollingIntervalSeconds: 0.5 },
});

export type Sender = "the worker's runtime" | "the outside client";

interface ClockEngine {
	readonly database: PostgresTestDatabase["Service"];
	readonly delivered: Queue.Queue<string>;
	readonly producers: Map<Sender, PgBossService>;
	testing: PgBossTesting | undefined;
}

export const testingClock = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	*create(): Effect.fn.Return<ClockEngine, never, PostgresTestDatabase> {
		return { database: yield* PostgresTestDatabase, delivered: yield* Queue.unbounded<string>(), producers: new Map(), testing: undefined };
	},
	inspect: ({ producers, testing }) => ({ producers: [...producers.keys()], worker: testing === undefined ? "not running" : "running" }),
	layer: postgresLayer,
	name: "testing controller clock",
	runIf: postgresConfigured,
	stages: ["worker", "outside"],
	verbs: (engine, story) => {
		function controller() {
			if (engine.testing === undefined) {
				throw new Error("No worker runtime is running");
			}
			return engine.testing;
		}
		return {
			anotherJobsLayerStarts: () => {
				story.tell("a second jobs Layer, built separately, takes its client from the same controller");
				return Layer.build(
					OutsideProducer.layer({ jobs: [Work] }).pipe(
						Layer.provide(pgBossLayer({ connectionString: engine.database.url })),
						Layer.provide(Layer.succeed(JobsClientFactory, controller().clientFactory)),
					),
				).pipe(
					Effect.as("started"),
					Effect.catch((error) => Effect.succeed(failureOf(error))),
				);
			},
			delivered: () =>
				Effect.map(
					Queue.poll(engine.delivered),
					Option.getOrElse(() => "nothing delivered"),
				),
			publish: (message: string, from: Sender) => {
				story.tell(`${from} publishes ${message}`);
				const producer = engine.producers.get(from);
				if (producer === undefined) {
					return Effect.die(new Error(`${from} is not running`));
				}
				return Effect.asVoid(producer.enqueue(Work, { message }));
			},
			untilIdle: () => {
				story.tell("the worker's testing controller waits until its queues are idle");
				return controller().waitForIdle;
			},
		};
	},
});

export function workerRuntimeOn(time: "the story's TestClock" | "real time") {
	return testingClock.trait(
		"worker",
		`one Layer supplies the testing client to the worker's runtime, which also produces, with its controller on ${time}`,
		function* (engine) {
			const testing = makePgBossTesting(time === "real time" ? {} : { clock: yield* TestClock.testClockWith(Effect.succeed) });
			const runtime = yield* Layer.build(
				Layer.merge(
					Worker.layer({ jobs: [Work.handle(({ message }) => Queue.offer(engine.delivered, message))] }),
					Producer.layer({ jobs: [Work] }),
				).pipe(
					Layer.provide(pgBossLayer({ connectionString: engine.database.url })),
					Layer.provide(Layer.succeed(JobsClientFactory, testing.clientFactory)),
				),
			);
			engine.testing = testing;
			engine.producers.set("the worker's runtime", Context.get(runtime, Producer));
		},
	);
}

export const outsideClient = testingClock.trait(
	"outside",
	"an outside producer enqueues through its own production pg-boss client",
	function* (engine) {
		const outside = yield* Layer.build(
			OutsideProducer.layer({ jobs: [Work] }).pipe(Layer.provide(pgBossLayer({ connectionString: engine.database.url }))),
		);
		engine.producers.set("the outside client", Context.get(outside, OutsideProducer));
	},
);
