import { Cause, Effect, Exit, Option } from "effect";
import { expect } from "vitest";
import { postgresIt, realPostgres, retryTracedJob } from "#test/boss.ts";

postgresIt(
	"runs every top-level Effect.fn step under one job root, independent of worker startup",
	[realPostgres],
	function* ({ traces, admin, untilJob }) {
		const client = yield* admin();
		const producer = yield* traces.producer();
		const jobId = Option.getOrThrow(yield* traces.send(producer.jobs, { id: 42 }));
		const stored = (yield* Effect.promise(() => client.findJobs(traces.queue.name, { id: jobId })))[0]?.data;
		yield* producer.stop;
		const worker = yield* traces.worker();
		yield* untilJob(worker.jobs, traces.queue, jobId, "completed");

		const job = traces.spans.find((span) => span.name === traces.queue.name);
		expect(job).toBeDefined();
		expect(job?.parent).toEqual(Option.none());
		expect(job?.kind).toBe("consumer");
		expect(job?.links).toEqual([]);
		expect(Object.fromEntries(job?.attributes ?? [])).toMatchObject({
			"job.attempt": 1,
			"job.id": jobId,
			"job.name": traces.queue.name,
			"job.queue": traces.queue.name,
			"job.retry_count": 0,
		});
		const trace = traces.spans.filter((span) => span.traceId === job?.traceId);
		expect(trace.map((span) => span.name)).toEqual([traces.queue.name, "Tracing.stepOne", "Tracing.stepTwo"]);
		for (const step of trace.slice(1)) {
			expect(Option.getOrThrow(step.parent).spanId).toBe(job?.spanId);
		}
		expect(trace.every((span) => span.status._tag === "Ended" && Exit.isSuccess(span.status.exit))).toBe(true);
		expect(traces.handled).toEqual([{ id: 42 }]);
		expect(stored).toEqual({ id: "42" });
	},
);

postgresIt(
	"persists a link to the sending request across producer shutdown without changing the typed payload",
	[realPostgres],
	function* ({ traces, admin, untilJob }) {
		const client = yield* admin();
		const producer = yield* traces.producer();
		const jobId = Option.getOrThrow(yield* traces.send(producer.jobs, { id: 42 }, true));
		const lookup = Option.getOrThrow(yield* producer.jobs.getJob(traces.queue, jobId));
		const stored = (yield* Effect.promise(() => client.findJobs(traces.queue.name, { id: jobId })))[0]?.data;
		yield* producer.stop;
		const worker = yield* traces.worker();
		yield* untilJob(worker.jobs, traces.queue, jobId, "completed");
		const sender = traces.spans.find((span) => span.name === "request");
		const job = traces.spans.find((span) => span.name === traces.queue.name);
		expect(sender).toBeDefined();
		expect(job).toBeDefined();
		expect(job?.parent).toEqual(Option.none());
		expect(job?.traceId).not.toBe(sender?.traceId);
		expect(job?.links).toMatchObject([{ span: { sampled: sender?.sampled, spanId: sender?.spanId, traceId: sender?.traceId } }]);
		expect(stored).toMatchObject({ payload: { id: "42" }, span: { spanId: sender?.spanId, traceId: sender?.traceId } });
		expect(traces.handled).toEqual([{ id: 42 }]);
		expect(lookup.data).toEqual({ id: 42 });
	},
);

postgresIt(
	"records the failure on the first job span and reports attempt two on a real retry",
	[realPostgres, retryTracedJob],
	function* ({ traces, untilJob }) {
		const producer = yield* traces.producer();
		const jobId = Option.getOrThrow(yield* traces.send(producer.jobs, { id: 42 }, true));
		yield* producer.stop;
		const worker = yield* traces.worker();
		yield* untilJob(worker.jobs, traces.queue, jobId, "completed");
		const jobs = traces.spans.filter((span) => span.name === traces.queue.name);
		expect(jobs).toMatchObject([{ status: { _tag: "Ended", exit: { _tag: "Failure" } } }, { status: { _tag: "Ended", exit: { _tag: "Success" } } }]);
		expect(jobs.map((span) => span.attributes.get("job.attempt"))).toEqual([1, 2]);
		expect(jobs.map((span) => span.attributes.get("job.retry_count"))).toEqual([0, 1]);
		expect(jobs[0]?.status).toMatchObject({ _tag: "Ended", exit: { _tag: "Failure" } });
		const failed = jobs[0]?.status;
		if (failed?._tag !== "Ended" || !Exit.isFailure(failed.exit)) {
			throw new Error("Expected the first job span to record a failure");
		}
		expect(Cause.pretty(failed.exit.cause)).toContain("Retry this job");
		expect(jobs[1]?.status).toMatchObject({ _tag: "Ended", exit: { _tag: "Success" } });
		expect(jobs[0]?.traceId).not.toBe(jobs[1]?.traceId);
		const sender = traces.spans.find((span) => span.name === "request");
		for (const job of jobs) {
			expect(job.links).toMatchObject([{ span: { spanId: sender?.spanId, traceId: sender?.traceId } }]);
		}
		expect(traces.handled).toEqual([{ id: 42 }, { id: 42 }]);
	},
);
