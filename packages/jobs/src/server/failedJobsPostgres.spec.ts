import { DateTime, Effect, Option, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import { acceleratedTesting, failingWorker } from "#test/acceleratedTesting.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";

postgresIt(
	"lists a job that exhausted its retries with its typed error, decoded payload and dead-letter copy",
	[realPostgres, acceleratedTesting, failingWorker],
	function* ({ attempts, deadLetteredJobs, failedJobs, queue, retry, send, service, settle }) {
		const id = Option.getOrThrow(yield* send(42, { retryLimit: 2 }).pipe(Effect.withSpan("sender")));
		yield* settle();
		expect(attempts).toEqual([42, 42, 42]);
		const error = { _tag: "WorkerRejected", message: "The worker fails this attempt: password=<redacted>" };

		const stored = Option.getOrThrow(yield* service().getJob(queue, id));
		expect(stored.output).toEqual(error);
		const failed = yield* failedJobs({ limit: 10 });
		expect(failed.next).toEqual(Option.none());
		expect(failed.jobs.map((listed) => listed.id)).toEqual([id]);
		const [job] = failed.jobs;
		expect(job).toMatchObject({ attempt: 3, data: { id: 42 }, id, output: error, queue: queue.name, retryCount: 2, retryLimit: 2, state: "failed" });
		expect(job).not.toHaveProperty("sourceId");
		const createdOn = job?.createdOn;
		const startedOn = Option.getOrThrow(job?.startedOn ?? Option.none());
		const completedOn = Option.getOrThrow(job?.completedOn ?? Option.none());
		for (const time of [createdOn, startedOn, completedOn]) {
			expect(DateTime.isDateTime(time) && DateTime.isUtc(time)).toBe(true);
		}
		expect(DateTime.toEpochMillis(completedOn)).toBeGreaterThanOrEqual(DateTime.toEpochMillis(startedOn));

		const deadLettered = yield* deadLetteredJobs({ limit: 10 });
		expect(deadLettered.next).toEqual(Option.none());
		expect(deadLettered.jobs.map((listed) => listed.sourceId)).toEqual([Option.some(id)]);
		const [copy] = deadLettered.jobs;
		expect(copy).toMatchObject({
			attempt: 0,
			data: { id: 42 },
			output: null,
			queue: deadLetterQueueName(queue.name),
			sourceId: Option.some(id),
			sourceOutput: error,
			state: "created",
		});
		expect(copy?.id).not.toBe(id);
		expect(copy?.startedOn).toEqual(Option.none());
		yield* retry(copy?.id ?? "");
		expect(yield* deadLetteredJobs({ limit: 10 })).toEqual(deadLettered);
		expect((yield* failedJobs({ limit: 10 })).jobs.map((listed) => listed.state)).toEqual(["failed"]);
	},
);

postgresIt(
	"pages failed jobs newest first and returns each exactly once while new failures arrive",
	[realPostgres, acceleratedTesting, failingWorker],
	function* ({ deadLetteredJobs, failedJobs, send, settle }) {
		const sent: string[] = [];
		for (const value of [1, 2, 3, 4, 5]) {
			sent.push(Option.getOrThrow(yield* send(value, { retryLimit: 0 })));
		}
		yield* settle();
		const first = yield* failedJobs({ limit: 2 });
		expect(first.jobs.map((job) => job.data.id)).toEqual([5, 4]);

		const later = Option.getOrThrow(yield* send(6, { retryLimit: 0 }));
		yield* settle();

		const pages = [first];
		let cursor = first.next;
		while (Option.isSome(cursor)) {
			const page = yield* failedJobs({ cursor: cursor.value, limit: 2 });
			pages.push(page);
			cursor = page.next;
		}
		expect(pages.map((page) => page.jobs.length)).toEqual([2, 2, 1]);
		expect(pages.flatMap((page) => page.jobs.map((job) => job.id))).toEqual([...sent].reverse());
		expect((yield* failedJobs({ limit: 1 })).jobs.map((job) => job.id)).toEqual([later]);

		const exact = yield* failedJobs({ limit: 6 });
		expect(exact.jobs.map((job) => job.id)).toEqual([later, ...[...sent].reverse()]);
		expect(exact.next).toEqual(Option.none());

		const copies = yield* deadLetteredJobs({ limit: 4 });
		const rest = yield* deadLetteredJobs({ cursor: Option.getOrThrow(copies.next), limit: 4 });
		const listed = [...copies.jobs, ...rest.jobs];
		const copyIds = listed.map((job) => job.id);
		expect([...new Set(copyIds)]).toEqual(copyIds);
		expect(new Set(listed.map((job) => Option.getOrThrow(job.sourceId)))).toEqual(new Set([later, ...sent]));
		const deadLetteredOn = listed.map((job) => DateTime.toEpochMillis(job.createdOn));
		expect(deadLetteredOn).toEqual([...deadLetteredOn].sort((left, right) => right - left));
		expect(rest.next).toEqual(Option.none());
	},
);

postgresIt(
	"fails typed when stored data does not decode and when the page request is invalid",
	[realPostgres, acceleratedTesting, failingWorker],
	function* ({ failedJobs, queue, send, service, settle }) {
		yield* send(7, { retryLimit: 0 });
		yield* settle();
		const incompatible = defineQueue({ name: queue.name, schema: Schema.Struct({ id: Schema.Number }) });
		const jobs = service();
		for (const listing of [jobs.failedJobs(incompatible, { limit: 10 }), jobs.deadLetteredJobs(incompatible, { limit: 10 })]) {
			expect(yield* listing.pipe(Effect.flip)).toMatchObject({ _tag: "PgBossPayloadError", direction: "decode", queue: queue.name });
		}
		for (const options of [
			{ limit: 0 },
			{ limit: 1.5 },
			{ cursor: "not a cursor", limit: 1 },
			{ cursor: Schema.encodeSync(Schema.StringFromBase64Url)(JSON.stringify(["tampered", "also tampered"])), limit: 1 },
		]) {
			expect(yield* failedJobs(options).pipe(Effect.flip)).toMatchObject({ _tag: "SchemaError" });
		}
	},
);

postgresIt(
	"runs a listed failed job again when it is passed to retry",
	[realPostgres, acceleratedTesting, failingWorker],
	function* ({ attempts, failedJobs, recoverWorker, retry, send, settle }) {
		yield* send(9, { retryLimit: 0 });
		yield* settle();
		const [listed] = (yield* failedJobs({ limit: 1 })).jobs;
		const id = listed?.id ?? "";
		yield* recoverWorker;
		yield* retry(id);
		expect(yield* settle()).toMatchObject([{ data: { id: 9 }, id, state: "completed" }]);
		expect(attempts).toEqual([9, 9]);
		expect((yield* failedJobs({ limit: 10 })).jobs).toEqual([]);
	},
);

postgresIt("redacts older pg-boss failure messages and omits their diagnostic fields when listing", [realPostgres], function* ({ boot, native }) {
	const queue = defineQueue({ name: "stored-failure", queue: { retryLimit: 0 }, schema: Schema.Struct({}) });
	const client = native();
	const { jobs } = yield* boot([queue], { clientFactory: () => client });
	const id = Option.getOrThrow(yield* jobs.enqueue(queue, {}));
	yield* Effect.promise(() =>
		client.fail(queue.name, id, {
			_tag: "LegacyRejected",
			cause: { message: "cause-secret" },
			message: "password=stored-secret",
			stack: "stack-secret",
		}),
	);
	const listed = yield* jobs.failedJobs(queue, { limit: 1 });
	expect(listed.jobs.map((job) => job.output)).toEqual([{ _tag: "LegacyRejected", message: "password=<redacted>" }]);
});
