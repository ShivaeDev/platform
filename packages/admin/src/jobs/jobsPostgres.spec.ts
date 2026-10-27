import { DateTime, Effect, Option } from "effect";
import { expect } from "vitest";
import { jobsRole, jobsStory } from "#test/jobsStory.ts";

jobsStory.it(
	"carries database values, both payload codecs and source metadata through RPC",
	[jobsRole("admin")],
	function* ({ counts, deadLettered, failed, job, responses, send, sendPrivate, sendSync, settle, waitForHealth }) {
		const id = yield* send(42);
		const sync = yield* sendSync();
		yield* sendPrivate();
		yield* settle();
		expect(yield* counts()).toEqual({ activeCount: 0, failedCount: 1, queuedCount: 0, totalCount: 1 });
		const health = yield* waitForHealth((value) => value.failedTotal === 1 && value.deadLetteredTotal === 1 && value.queuedTotal === 1);
		expect(health).toEqual({
			activeTotal: 0,
			deadLetteredTotal: 1,
			failedTotal: 1,
			jobs: [
				{ activeCount: 0, deadLetteredCount: 1, failedCount: 1, name: "mail", queuedCount: 0, readyCount: 0 },
				{ activeCount: 0, deadLetteredCount: 0, failedCount: 0, name: "sync", queuedCount: 1, readyCount: 1 },
			],
			queuedTotal: 1,
			readyTotal: 1,
		});
		const failures = yield* failed(10);
		expect(failures.jobs.map((listed) => listed.id)).toEqual([id]);
		expect(failures.next).toEqual(Option.none());

		expect(failures.jobs[0]).toMatchObject({
			attempt: 1,
			data: { id: 42 },
			id,
			output: { _tag: "WorkerRejected", id: 42 },
			queue: "mail",
			state: "failed",
		});
		const detail = Option.getOrThrow(yield* job(id));
		expect(detail).toEqual(failures.jobs[0]);
		expect(DateTime.isUtc(detail.createdOn)).toBe(true);
		expect(DateTime.toEpochMillis(Option.getOrThrow(detail.completedOn))).toBeGreaterThanOrEqual(
			DateTime.toEpochMillis(Option.getOrThrow(detail.startedOn)),
		);
		const copies = yield* deadLettered(10);
		expect(copies.jobs.map((listed) => listed.sourceId)).toEqual([Option.some(id)]);
		expect(copies.next).toEqual(Option.none());

		expect(copies.jobs[0]).toMatchObject({
			attempt: 0,
			data: { id: 42 },
			queue: "mail-dlq",
			sourceId: Option.some(id),
			sourceOutput: { _tag: "WorkerRejected", id: 42 },
			startedOn: Option.none(),
		});
		expect(Option.getOrThrow(yield* job(sync, "sync"))).toMatchObject({ data: { key: "sync-key" }, queue: "sync", state: "created" });
		expect(responses().join("\n")).toContain('"data":{"id":"42"}');
	},
);

jobsStory.it(
	"pages failed and dead-lettered jobs without omissions or duplicates",
	[jobsRole("admin")],
	function* ({ deadLettered, failed, send, settle }) {
		const ids: string[] = [];
		for (const id of [1, 2, 3]) {
			ids.push(yield* send(id));
		}
		yield* settle();
		const first = yield* failed(2);
		const second = yield* failed(2, Option.getOrThrow(first.next));
		expect(first.jobs.map((listed) => listed.id)).toEqual([ids[2], ids[1]]);
		expect(second.jobs.map((listed) => listed.id)).toEqual([ids[0]]);
		expect(second.next).toEqual(Option.none());
		const copies = yield* deadLettered(2);
		const rest = yield* deadLettered(2, Option.getOrThrow(copies.next));
		const all = [...copies.jobs, ...rest.jobs];
		expect(all).toHaveLength(ids.length);
		expect(new Set(all.map((listed) => listed.id)).size).toBe(ids.length);
		expect(new Set(all.map((job) => Option.getOrThrow(job.sourceId)))).toEqual(new Set(ids));
		expect(rest.next).toEqual(Option.none());
	},
);

jobsStory.it("returns no job for a missing id or another queue's id", [jobsRole("admin")], function* ({ job, sendSync }) {
	expect(yield* job("00000000-0000-0000-0000-000000000001")).toEqual(Option.none());
	expect(yield* job(yield* sendSync())).toEqual(Option.none());
});

jobsStory.it(
	"refuses every read of an unregistered queue and its dead-letter queue",
	[jobsRole("admin")],
	function* ({ counts, deadLettered, failed, job, registrationReads }) {
		for (const queue of ["private", "mail-dlq"]) {
			for (const read of [counts(queue), failed(1, undefined, queue), deadLettered(1, undefined, queue), job("missing", queue)]) {
				expect(yield* Effect.flip<unknown, unknown, never>(read)).toMatchObject({ _tag: "JobsQueueUnregistered", queue });
			}
		}
		expect(registrationReads()).toBe(0);
	},
);

jobsStory.it("registers and serves another page without querying jobs", [jobsRole("admin")], function* ({ profile, registrationReads }) {
	expect(registrationReads()).toBe(0);
	expect(yield* profile()).toBe("operator@example.test");
	expect(registrationReads()).toBe(0);
});

jobsStory.it(
	"declares payload and storage failures while keeping another page usable",
	[jobsRole("admin")],
	function* ({ stopJobs, counts, deadLettered, failed, job, profile, sendInvalid, settle }) {
		const id = yield* sendInvalid();
		yield* settle();
		for (const read of [failed(1), job(id)]) {
			expect(yield* Effect.flip<unknown, unknown, never>(read)).toMatchObject({ _tag: "JobsPayloadInvalid", queue: "mail" });
		}
		expect(yield* Effect.flip(failed(0))).toMatchObject({ _tag: "JobsUnavailable", operation: "failedJobs" });
		expect(yield* Effect.flip(deadLettered(1, "invalid cursor"))).toMatchObject({ _tag: "JobsUnavailable", operation: "deadLetteredJobs" });
		yield* stopJobs();
		expect(yield* Effect.flip(counts())).toMatchObject({ _tag: "JobsUnavailable", operation: "counts" });
		expect(yield* profile()).toBe("operator@example.test");
	},
);

for (const [role, traits, error] of [
	["signed out", [], "Unauthorized"],
	["member", [jobsRole("user")], "Forbidden"],
	["role assigner without jobs.read", [jobsRole("assigner")], "Forbidden"],
] as const) {
	jobsStory.it(`refuses a ${role} across all Jobs reads`, traits, function* ({ counts, deadLettered, failed, health, job, registrationReads }) {
		for (const read of [counts(), deadLettered(1), failed(1), health(), job("missing")]) {
			expect(yield* Effect.flip<unknown, unknown, never>(read)).toMatchObject({ _tag: error });
		}
		expect(registrationReads()).toBe(0);
	});
}
