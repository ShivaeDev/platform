import { Effect, Layer, Option, Schema } from "effect";
import { PgBoss } from "pg-boss";
import { defineQueue } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import { makePgBoss } from "#service.ts";
import { recordingTracer } from "#test/recordingTracer.ts";
import { until } from "#test/until.ts";

export async function tracedJob(databaseUrl: string, mode: "root" | "linked" | "retry") {
	const Queue = defineQueue({
		name: `tracing-${crypto.randomUUID()}`,
		queue: { retryBackoff: false, retryDelay: 0, retryLimit: 1 },
		schema: Schema.Struct({ id: Schema.NumberFromString }),
		worker: { pollingIntervalSeconds: 0.5 },
	});
	const options = { connectionString: databaseUrl, schema: "platform_effect_pg_boss" };
	const admin = new PgBoss(options);
	const Producer = makePgBoss("@test/TracingProducer");
	const Worker = makePgBoss("@test/TracingWorker");
	const { spans, tracer } = recordingTracer();
	const handled: object[] = [];
	const stepOne = Effect.fn("Tracing.stepOne")(() => Effect.void);
	const stepTwo = Effect.fn("Tracing.stepTwo")(() => Effect.void);
	const worker = Queue.handle((payload) =>
		Effect.gen(function* () {
			handled.push(payload);
			yield* stepOne();
			yield* stepTwo();
			if (mode === "retry" && handled.length === 1) {
				return yield* Effect.fail(new Error("Retry this job"));
			}
		}),
	);
	await admin.start();
	try {
		return await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const id = yield* Effect.scoped(
						Effect.gen(function* () {
							const producer = yield* Producer;
							const send = producer.enqueue(Queue, { id: 42 });
							const jobId = Option.getOrThrow(yield* mode === "root" ? send : send.pipe(Effect.withSpan("request")));
							const lookup = Option.getOrThrow(yield* producer.getJob(Queue, jobId));
							return { jobId, lookup };
						}).pipe(Effect.provide(Producer.layer({ ...options, jobs: [Queue] }))),
					);
					const stored = yield* Effect.promise(() => admin.findJobs(Queue.name, { id: id.jobId }));
					yield* Layer.build(Worker.layer({ ...options, jobs: [worker] })).pipe(Effect.withSpan("worker-startup"));
					yield* Effect.promise(() =>
						until(async () => {
							const job = (await admin.findJobs(Queue.name, { id: id.jobId }))[0];
							return job?.state === "completed" ? job : undefined;
						}),
					);
					return { ...id, handled, queue: Queue.name, spans, stored: stored[0]?.data };
				}),
			).pipe(Effect.withTracer(tracer)),
		);
	} finally {
		await admin.deleteQueue(Queue.name);
		await admin.deleteQueue(deadLetterQueueName(Queue.name));
		await admin.stop();
	}
}
