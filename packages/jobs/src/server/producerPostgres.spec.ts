import { Effect, Option, Schema } from "effect";
import { expect, vi } from "vitest";
import { defineQueue } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";

postgresIt(
	"creates producer queues and dead-letters an encoded job after the worker exhausts retries",
	[realPostgres],
	function* ({ boot, admin, untilJobs }) {
		const Queue = defineQueue({
			name: "producer",
			queue: { retryBackoff: false, retryDelay: 0, retryLimit: 2 },
			schema: Schema.Struct({ id: Schema.NumberFromString }),
			worker: { pollingIntervalSeconds: 0.5 },
		});
		const deadLetter = deadLetterQueueName(Queue.name);
		const client = yield* admin();
		const handled = vi.fn<(id: number) => void>();
		const producer = yield* boot([Queue]);
		expect(yield* Effect.promise(() => client.getQueue(Queue.name))).toMatchObject({ deadLetter, retryLimit: 2 });
		expect(yield* Effect.promise(() => client.getQueue(deadLetter))).toMatchObject({ name: deadLetter });
		const jobId = Option.getOrThrow(yield* producer.jobs.enqueue(Queue, { id: 42 }));
		expect(yield* Effect.promise(() => client.findJobs(Queue.name))).toMatchObject([{ data: { id: "42" }, id: jobId, state: "created" }]);
		expect(handled).not.toHaveBeenCalled();
		yield* producer.stop;
		yield* boot([Queue.handle(({ id }) => Effect.sync(() => handled(id)).pipe(Effect.andThen(Effect.fail(new Error("Retry this job")))))]);
		const entries = yield* untilJobs(client, deadLetter, (jobs) => jobs.length > 0);
		expect(entries[0]).toMatchObject({ data: { id: "42" }, sourceId: jobId, sourceName: Queue.name });
		expect(handled.mock.calls).toEqual([[42], [42], [42]]);
		expect(yield* Effect.promise(() => client.findJobs(Queue.name))).toMatchObject([{ id: jobId, retryCount: 2, state: "failed" }]);
	},
);

postgresIt(
	"replaces administrator-terminated idle connections without an unhandled error",
	[realPostgres],
	function* ({ boot, admin, logs, terminateIdle, until, untilJobs }) {
		const Queue = defineQueue({ name: "terminated-idle", schema: Schema.Struct({ id: Schema.NumberFromString }) });
		const producer = yield* boot([Queue], { "application_name": "story-producer" });
		const client = yield* admin({ "application_name": "story-admin" });
		const backend = Effect.promise(() => client.getDb().executeSql("select pg_backend_pid() as pid")).pipe(
			Effect.map(({ rows }) => Schema.decodeUnknownSync(Schema.Tuple([Schema.Struct({ pid: Schema.Number })]))(rows)[0].pid),
		);
		const idle = yield* backend;
		const producerIdle = yield* terminateIdle("story-producer");
		const adminIdle = yield* terminateIdle("story-admin");
		expect(adminIdle).toContain(idle);
		expect(producerIdle.length).toBeGreaterThan(0);
		const terminations = Effect.sync(() =>
			logs.filter(({ logLevel, message }) => logLevel === "Debug" && JSON.stringify(message).includes("administrator command")),
		);
		yield* until(terminations, (seen) => seen.length === producerIdle.length + adminIdle.length);
		expect(adminIdle).not.toContain(yield* backend);
		yield* Effect.promise(() => client.send(Queue.name, { id: "1" }));
		yield* producer.jobs.enqueue(Queue, { id: 2 });
		const jobs = yield* untilJobs<{ id: string }>(client, Queue.name, (found) => found.length === 2);
		expect(jobs.map(({ data }) => data.id).sort()).toEqual(["1", "2"]);
	},
);
