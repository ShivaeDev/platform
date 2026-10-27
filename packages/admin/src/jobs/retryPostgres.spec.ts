import { Effect, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { expect } from "vitest";
import { eventually } from "#test/eventually.ts";
import { jobsRole, jobsStory } from "#test/jobsStory.ts";

jobsStory.it("retries a failed original through RPC and refreshes mounted Jobs views", [jobsRole("admin")], function* (test) {
	const id = yield* test.send(42);
	const originalIds = [id];
	yield* test.settle();
	yield* test.waitForHealth((value) => value.failedTotal === originalIds.length);
	const health = test.api.health.query(undefined);
	const counts = test.api.counts.query({ queue: "mail" });
	const failed = test.api.failed.query({ limit: 10, queue: "mail" });
	const copies = test.api.deadLettered.query({ limit: 10, queue: "mail" });
	const job = test.api.job.query({ id, queue: "mail" });
	const views: readonly Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>[] = [health, counts, failed, copies, job];
	for (const atom of views) {
		test.registry.mount(atom);
	}
	yield* eventually(() => {
		expect(AsyncResult.getOrElse(test.registry.get(health), () => undefined)?.failedTotal).toBe(originalIds.length);
		expect(AsyncResult.getOrElse(test.registry.get(counts), () => undefined)?.failedCount).toBe(originalIds.length);
		expect(AsyncResult.getOrElse(test.registry.get(failed), () => undefined)?.jobs.map((listed) => listed.id)).toEqual(originalIds);
		expect(AsyncResult.getOrElse(test.registry.get(copies), () => undefined)?.jobs.map((copy) => copy.sourceId)).toEqual(
			originalIds.map(Option.some),
		);
		expect(Option.getOrUndefined(AsyncResult.getOrElse(test.registry.get(job), () => Option.none()))?.state).toBe("failed");
	});
	const before = views.map((atom) => test.registry.get(atom));
	expect(test.deliveries()).toEqual([id]);
	yield* test.retry(id);
	yield* test.settle();
	expect(test.deliveries()).toEqual([id, id]);
	expect(Option.getOrThrow(yield* test.job(id))).toMatchObject({ id, state: "completed" });
	yield* eventually(() => {
		for (const [index, atom] of views.entries()) {
			const value = test.registry.get(atom);
			expect(AsyncResult.isSuccess(value)).toBe(true);
			expect(value).not.toBe(before[index]);
		}
		expect(AsyncResult.getOrElse(test.registry.get(counts), () => undefined)?.failedCount).toBe(0);
		expect(AsyncResult.getOrElse(test.registry.get(failed), () => undefined)?.jobs).toEqual([]);
		expect(Option.getOrUndefined(AsyncResult.getOrElse(test.registry.get(job), () => Option.none()))?.state).not.toBe("failed");
	});
});

jobsStory.it("rejects dead-letter copies, unregistered queues and jobs that are not failed", [jobsRole("admin")], function* (test) {
	const id = yield* test.send(42);
	yield* test.settle();
	const copy = Option.getOrThrow(Option.fromNullishOr((yield* test.deadLettered(1)).jobs[0]));
	const sync = yield* test.sendSync();
	expect(yield* Effect.flip(test.retry(copy.id, copy.queue))).toMatchObject({ _tag: "JobsQueueUnregistered", queue: "mail-dlq" });
	for (const other of [copy.id, "00000000-0000-0000-0000-000000000001", sync]) {
		expect(yield* Effect.flip(test.retry(other))).toMatchObject({ _tag: "JobsNotFailed", id: other });
	}
	expect(yield* Effect.flip(test.retry(id, "private"))).toMatchObject({ _tag: "JobsQueueUnregistered", queue: "private" });
	expect(yield* Effect.flip(test.retry(sync, "sync"))).toMatchObject({ _tag: "JobsNotFailed" });
	yield* test.settle();
	expect(test.deliveries()).toEqual([id]);
	expect((yield* test.deadLettered(1)).jobs).toEqual([copy]);
});

for (const [role, traits, error] of [
	["signed out", [], "Unauthorized"],
	["member", [jobsRole("user")], "Forbidden"],
	["role assigner without jobs.read", [jobsRole("assigner")], "Forbidden"],
] as const) {
	jobsStory.it(`refuses a ${role} retry of a failed job`, traits, function* (test) {
		const id = yield* test.send(42);
		yield* test.settle();
		expect(yield* Effect.flip(test.retry(id))).toMatchObject({ _tag: error });
		yield* test.settle();
		expect(test.deliveries()).toEqual([id]);
	});
}
