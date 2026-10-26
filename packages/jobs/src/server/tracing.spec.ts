import { Effect, Option, Schema, Tracer } from "effect";
import { expect } from "vitest";
import { defineQueue, defineSchedule } from "#definition.ts";
import { PgBossPayloadError } from "#error.ts";
import { boss } from "#test/boss.ts";
import { job } from "#test/fakeClient.ts";
import { recordingTracer } from "#test/recordingTracer.ts";

boss.it("parents scheduled Effect.fn steps to a job span and records scheduled failures", [], function* ({ boot, client, dispatch }) {
	const Schedule = defineSchedule({ cron: "17 3 * * *", name: "scheduled-trace" });
	const scheduledStep = Effect.fn("Tracing.scheduledStep")(() => Effect.fail(new Error("Scheduled failure")));
	const { spans, tracer } = recordingTracer();
	const runtime = yield* boot([Schedule.run(Effect.suspend(scheduledStep))]).pipe(Effect.withSpan("startup"), Effect.withTracer(tracer));
	yield* dispatch(Schedule.name, [job(Schedule.name, null)]);
	expect(client.failCalls[0]?.error).toEqual(new Error("Scheduled failure"));
	yield* runtime.stop;
	const scheduled = spans.find((span) => span.name === Schedule.name);
	const child = spans.find((span) => span.name === "Tracing.scheduledStep");
	expect(scheduled?.parent).toEqual(Option.none());
	expect(scheduled?.status).toMatchObject({ _tag: "Ended", exit: { _tag: "Failure" } });
	expect(child?.parent).toEqual(Option.some(scheduled));
	expect(child?.traceId).toBe(scheduled?.traceId);
});

boss.it("carries an external parent span without exposing the transport envelope to the handler", [], function* ({ boot, client, dispatch }) {
	const Queue = defineQueue({ name: "external-trace", schema: Schema.Struct({ id: Schema.NumberFromString }) });
	const external = Tracer.externalSpan({ sampled: false, spanId: "0123456789abcdef", traceId: "0123456789abcdef0123456789abcdef" });
	const { spans, tracer } = recordingTracer();
	const handled: object[] = [];
	const runtime = yield* boot([Queue.handle((payload) => Effect.sync(() => handled.push(payload)))]).pipe(Effect.withTracer(tracer));
	yield* runtime.jobs.enqueue(Queue, { id: 7 }).pipe(Effect.withParentSpan(external));
	const data = client.sendCalls[0]?.data;
	expect(data).toMatchObject({ _tag: "@shivaedev/jobs/TracedPayload", payload: { id: "7" } });
	yield* dispatch(Queue.name, [job(Queue.name, data)]);
	yield* runtime.stop;
	expect(handled).toEqual([{ id: 7 }]);
	expect(spans).toMatchObject([{ links: [{ span: { sampled: false, spanId: external.spanId, traceId: external.traceId } }], parent: Option.none() }]);
});

boss.it("decodes queued envelopes with the persisted trace tag before running the handler", [], function* ({ boot, client, dispatch }) {
	const Queue = defineQueue({ name: "persisted-trace", schema: Schema.Struct({ id: Schema.NumberFromString }) });
	const span = { sampled: true, spanId: "0123456789abcdef", traceId: "0123456789abcdef0123456789abcdef" };
	const { spans, tracer } = recordingTracer();
	const handled: object[] = [];
	const runtime = yield* boot([Queue.handle((payload) => Effect.sync(() => handled.push(payload)))]).pipe(Effect.withTracer(tracer));
	yield* dispatch(Queue.name, [job(Queue.name, { _tag: "@shivaedev/jobs/TracedPayload", payload: { id: "7" }, span })]);
	yield* runtime.stop;
	expect(handled).toEqual([{ id: 7 }]);
	expect(client.failCalls).toEqual([]);
	expect(spans[0]?.links).toMatchObject([{ span }]);
});

boss.it("records payload decoding failures on the job span before running the handler", [], function* ({ boot, client, dispatch }) {
	const Queue = defineQueue({ name: "invalid-trace", schema: Schema.Struct({ id: Schema.Number }) });
	const { spans, tracer } = recordingTracer();
	let handled = false;
	const worker = Queue.handle(() =>
		Effect.sync(() => {
			handled = true;
		}),
	);
	const runtime = yield* boot([worker]).pipe(Effect.withTracer(tracer));
	yield* dispatch(Queue.name, [job(Queue.name, { id: "invalid" })]);
	expect(client.failCalls[0]?.error).toBeInstanceOf(PgBossPayloadError);
	yield* runtime.stop;
	expect(handled).toBe(false);
	expect(spans).toMatchObject([{ name: Queue.name, status: { _tag: "Ended", exit: { _tag: "Failure" } } }]);
});
