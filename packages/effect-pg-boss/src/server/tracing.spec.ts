import { Effect, Layer, Option, Schema, Tracer } from "effect";
import { expect, it } from "vitest";
import { defineQueue, defineSchedule } from "#definition.ts";
import { PgBossPayloadError } from "#error.ts";
import { makePgBoss } from "#service.ts";
import { constructorOptions, FakeClient, job } from "#test/fake-client.ts";
import { recordingTracer } from "#test/recordingTracer.ts";

it("parents scheduled Effect.fn steps to a job span and records scheduled failures", async () => {
	const client = new FakeClient();
	const Jobs = makePgBoss("@test/ScheduledTracing");
	const Schedule = defineSchedule({ cron: "17 3 * * *", name: "scheduled-trace" });
	const scheduledStep = Effect.fn("Tracing.scheduledStep")(() => Effect.fail(new Error("Scheduled failure")));
	const { spans, tracer } = recordingTracer();
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				yield* Layer.build(
					Jobs.layer({ ...constructorOptions, clientFactory: () => client, jobs: [Schedule.run(Effect.suspend(scheduledStep))] }),
				).pipe(Effect.withSpan("startup"));
				yield* Effect.promise(() => client.workers[0]?.run([job(Schedule.name, null)]) ?? Promise.resolve());
				expect(client.failCalls[0]?.error).toEqual(new Error("Scheduled failure"));
			}),
		).pipe(Effect.withTracer(tracer)),
	);
	const scheduled = spans.find((span) => span.name === Schedule.name);
	const child = spans.find((span) => span.name === "Tracing.scheduledStep");
	expect(scheduled?.parent).toEqual(Option.none());
	expect(scheduled?.status).toMatchObject({ _tag: "Ended", exit: { _tag: "Failure" } });
	expect(child?.parent).toEqual(Option.some(scheduled));
	expect(child?.traceId).toBe(scheduled?.traceId);
});

it("carries an external parent span without exposing the transport envelope to the handler", async () => {
	const client = new FakeClient();
	const Jobs = makePgBoss("@test/ExternalTracing");
	const Queue = defineQueue({ name: "external-trace", schema: Schema.Struct({ id: Schema.NumberFromString }) });
	const external = Tracer.externalSpan({ sampled: false, spanId: "0123456789abcdef", traceId: "0123456789abcdef0123456789abcdef" });
	const { spans, tracer } = recordingTracer();
	const handled: object[] = [];
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const jobs = yield* Jobs;
				yield* jobs.enqueue(Queue, { id: 7 }).pipe(Effect.withParentSpan(external));
				const data = client.sendCalls[0]?.data;
				yield* Effect.promise(() => client.workers[0]?.run([job(Queue.name, data)]) ?? Promise.resolve());
			}).pipe(
				Effect.provide(
					Jobs.layer({
						...constructorOptions,
						clientFactory: () => client,
						jobs: [Queue.handle((payload) => Effect.sync(() => handled.push(payload)))],
					}),
				),
			),
		).pipe(Effect.withTracer(tracer)),
	);
	expect(handled).toEqual([{ id: 7 }]);
	expect(spans).toHaveLength(1);
	expect(spans[0]?.parent).toEqual(Option.none());
	expect(spans[0]?.links).toMatchObject([{ span: { sampled: false, spanId: external.spanId, traceId: external.traceId } }]);
});

it("records payload decoding failures on the job span before running the handler", async () => {
	const client = new FakeClient();
	const Jobs = makePgBoss("@test/InvalidTracing");
	const Queue = defineQueue({ name: "invalid-trace", schema: Schema.Struct({ id: Schema.Number }) });
	const { spans, tracer } = recordingTracer();
	let handled = false;
	const worker = Queue.handle(() =>
		Effect.sync(() => {
			handled = true;
		}),
	);
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				yield* Jobs;
				yield* Effect.promise(() => client.workers[0]?.run([job(Queue.name, { id: "invalid" })]) ?? Promise.resolve());
				expect(client.failCalls[0]?.error).toBeInstanceOf(PgBossPayloadError);
			}).pipe(Effect.provide(Jobs.layer({ ...constructorOptions, clientFactory: () => client, jobs: [worker] }))),
		).pipe(Effect.withTracer(tracer)),
	);
	expect(handled).toBe(false);
	expect(spans).toHaveLength(1);
	expect(spans[0]?.status).toMatchObject({ _tag: "Ended", exit: { _tag: "Failure" } });
});
