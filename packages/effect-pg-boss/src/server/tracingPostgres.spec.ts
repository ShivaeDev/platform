import { Cause, Effect, Exit, Option } from "effect";
import { expect } from "vitest";
import { boss, realPostgres, retryTracedJob } from "#test/boss.ts";
import { eventually } from "#test/eventually.ts";
import { postgresConfigured } from "#test/postgresLayer.ts";

boss.it.runIf(postgresConfigured)(
	"runs every top-level Effect.fn step under one job root, independent of worker startup",
	[realPostgres],
	function* ({ traces, admin }) {
		const client = yield* admin();
		const producer = yield* traces.producer();
		const jobId = Option.getOrThrow(yield* traces.send(producer.jobs, { id: 42 }));
		const stored = (yield* Effect.promise(() => client.findJobs(traces.queue.name, { id: jobId })))[0]?.data;
		yield* producer.stop;
		const worker = yield* traces.worker();
		yield* eventually(worker.jobs.getJob(traces.queue, jobId), (found) => Option.getOrUndefined(found)?.state === "completed");
		const result = { ...traces, jobId, queue: traces.queue.name, stored };

		const job = result.spans.find((span) => span.name === result.queue);
		expect(job).toBeDefined();
		expect(job?.parent).toEqual(Option.none());
		expect(job?.kind).toBe("consumer");
		expect(job?.links).toEqual([]);
		expect(Object.fromEntries(job?.attributes ?? [])).toMatchObject({
			"job.attempt": 1,
			"job.id": result.jobId,
			"job.name": result.queue,
			"job.queue": result.queue,
			"job.retry_count": 0,
		});
		const trace = result.spans.filter((span) => span.traceId === job?.traceId);
		expect(trace.map((span) => span.name)).toEqual([result.queue, "Tracing.stepOne", "Tracing.stepTwo"]);
		for (const step of trace.slice(1)) {
			expect(Option.getOrThrow(step.parent).spanId).toBe(job?.spanId);
		}
		expect(trace.every((span) => span.status._tag === "Ended" && Exit.isSuccess(span.status.exit))).toBe(true);
		expect(result.handled).toEqual([{ id: 42 }]);
		expect(result.stored).toEqual({ id: "42" });
	},
);

boss.it.runIf(postgresConfigured)(
	"persists a link to the sending request across producer shutdown without changing the typed payload",
	[realPostgres],
	function* ({ traces, admin }) {
		const client = yield* admin();
		const producer = yield* traces.producer();
		const jobId = Option.getOrThrow(yield* traces.send(producer.jobs, { id: 42 }, true));
		const lookup = Option.getOrThrow(yield* producer.jobs.getJob(traces.queue, jobId));
		const stored = (yield* Effect.promise(() => client.findJobs(traces.queue.name, { id: jobId })))[0]?.data;
		yield* producer.stop;
		const worker = yield* traces.worker();
		yield* eventually(worker.jobs.getJob(traces.queue, jobId), (found) => Option.getOrUndefined(found)?.state === "completed");
		const result = { ...traces, lookup, queue: traces.queue.name, stored };
		const sender = result.spans.find((span) => span.name === "request");
		const job = result.spans.find((span) => span.name === result.queue);
		expect(sender).toBeDefined();
		expect(job).toBeDefined();
		expect(job?.parent).toEqual(Option.none());
		expect(job?.traceId).not.toBe(sender?.traceId);
		expect(job?.links).toMatchObject([{ span: { sampled: sender?.sampled, spanId: sender?.spanId, traceId: sender?.traceId } }]);
		expect(result.stored).toMatchObject({ payload: { id: "42" }, span: { spanId: sender?.spanId, traceId: sender?.traceId } });
		expect(result.handled).toEqual([{ id: 42 }]);
		expect(result.lookup.data).toEqual({ id: 42 });
	},
);

boss.it.runIf(postgresConfigured)(
	"records the failure on the first job span and reports attempt two on a real retry",
	[realPostgres, retryTracedJob],
	function* ({ traces }) {
		const producer = yield* traces.producer();
		const jobId = Option.getOrThrow(yield* traces.send(producer.jobs, { id: 42 }, true));
		yield* producer.stop;
		const worker = yield* traces.worker();
		yield* eventually(worker.jobs.getJob(traces.queue, jobId), (found) => Option.getOrUndefined(found)?.state === "completed");
		const result = { ...traces, queue: traces.queue.name };
		const jobs = result.spans.filter((span) => span.name === result.queue);
		expect(jobs).toHaveLength(2);
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
		const sender = result.spans.find((span) => span.name === "request");
		for (const job of jobs) {
			expect(job.links).toMatchObject([{ span: { spanId: sender?.spanId, traceId: sender?.traceId } }]);
		}
		expect(result.handled).toEqual([{ id: 42 }, { id: 42 }]);
	},
);
