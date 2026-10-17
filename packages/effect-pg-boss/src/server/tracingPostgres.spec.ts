import { Cause, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";
import { environmentVariable } from "#test/environment.ts";
import { tracedJob } from "#test/tracedJob.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL") ?? "";
const integration = databaseUrl === "" ? describe.skip : describe;

integration("PostgreSQL job tracing", () => {
	it("runs every top-level Effect.fn step under one job root, independent of worker startup", async () => {
		const result = await tracedJob(databaseUrl, "root");
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
	});

	it("persists a link to the sending request across producer shutdown without changing the typed payload", async () => {
		const result = await tracedJob(databaseUrl, "linked");
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
	});

	it("records the failure on the first job span and reports attempt two on a real retry", async () => {
		const result = await tracedJob(databaseUrl, "retry");
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
	});
});
