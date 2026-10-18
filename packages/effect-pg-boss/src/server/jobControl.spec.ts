import { Effect, Option, Schema } from "effect";
import { expect, vi } from "vitest";
import { defineQueue } from "#definition.ts";
import { boss } from "#test/boss.ts";
import { scriptedClient } from "#test/scriptedClient.ts";
import { storedJob } from "#test/storedJob.ts";

const Queue = defineQueue({ name: "control", schema: Schema.Struct({ id: Schema.NumberFromString }) });

boss.it("decodes lookup payloads and preserves job metadata", [], function* ({ boot }) {
	const stored = storedJob(Queue.name, { id: "42" });
	const findJobs = vi.fn(async () => [stored]);
	const { jobs } = yield* boot([], { clientFactory: () => scriptedClient({ findJobs }) });
	expect(Option.getOrThrow(yield* jobs.getJob(Queue, "job-id"))).toEqual({ ...stored, data: { id: 42 } });
	expect(findJobs).toHaveBeenCalledWith(Queue.name, { id: "job-id" });
});

boss.it("returns None for a missing ID and a typed decode error for malformed durable data", [], function* ({ boot }) {
	const missing = yield* boot([], { clientFactory: () => scriptedClient({ findJobs: async () => [] }) });
	expect(Option.isNone(yield* missing.jobs.getJob(Queue, "missing"))).toBe(true);
	const malformed = yield* boot([], { clientFactory: () => scriptedClient({ findJobs: async () => [storedJob(Queue.name, { id: null })] }) });
	expect(yield* Effect.flip(malformed.jobs.getJob(Queue, "bad"))).toMatchObject({
		_tag: "PgBossPayloadError",
		direction: "decode",
		queue: Queue.name,
	});
});

for (const state of ["active", "completed", "cancelled", "created", "missing"] as const) {
	boss.it(`leaves a ${state} job unchanged when retry is requested`, [], function* ({ boot }) {
		const retry = vi.fn();
		const update = vi.fn();
		const client = scriptedClient({ findJobs: async () => (state === "missing" ? [] : [{ ...storedJob(Queue.name, {}), state }]), retry, update });
		const { jobs } = yield* boot([], { clientFactory: () => client });
		yield* jobs.retry(Queue, "job-id");
		expect(retry).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});
}

boss.it("maps missing custom client capabilities to operation-specific typed failures", [], function* ({ boot }) {
	const { jobs } = yield* boot([], { clientFactory: () => scriptedClient({}) });
	for (const [operation, effect] of [
		["counts", jobs.counts(Queue)],
		["getJob", jobs.getJob(Queue, "id")],
		["retry", jobs.retry(Queue, "id")],
	] as const) {
		expect(yield* Effect.flip(effect)).toMatchObject({ _tag: "PgBossError", operation, queue: Queue.name });
	}
});
