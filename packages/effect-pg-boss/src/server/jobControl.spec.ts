import { Effect, Option, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import { defineQueue } from "#definition.ts";
import { makeService } from "#internal/service.ts";
import { scriptedClient } from "#test/scriptedClient.ts";
import { storedJob } from "#test/storedJob.ts";

const Queue = defineQueue({ name: "control", schema: Schema.Struct({ id: Schema.NumberFromString }) });

describe("job control boundaries", () => {
	it("decodes lookup payloads and preserves job metadata", async () => {
		const stored = storedJob(Queue.name, { id: "42" });
		const findJobs = vi.fn(async () => [stored]);
		const service = makeService(scriptedClient({ findJobs }), []);
		expect(Option.getOrThrow(await Effect.runPromise(service.getJob(Queue, "job-id")))).toEqual({ ...stored, data: { id: 42 } });
		expect(findJobs).toHaveBeenCalledWith(Queue.name, { id: "job-id" });
	});

	it("returns None for a missing ID and a typed decode error for malformed durable data", async () => {
		const missing = makeService(scriptedClient({ findJobs: async () => [] }), []);
		expect(Option.isNone(await Effect.runPromise(missing.getJob(Queue, "missing")))).toBe(true);
		const malformed = makeService(scriptedClient({ findJobs: async () => [storedJob(Queue.name, { id: null })] }), []);
		await expect(Effect.runPromise(malformed.getJob(Queue, "bad"))).rejects.toMatchObject({
			_tag: "PgBossPayloadError",
			direction: "decode",
			queue: Queue.name,
		});
	});

	it.each(["active", "completed", "cancelled", "created", "missing"] as const)("leaves a %s job unchanged when retry is requested", async (state) => {
		const retry = vi.fn();
		const update = vi.fn();
		const client = scriptedClient({ findJobs: async () => (state === "missing" ? [] : [{ ...storedJob(Queue.name, {}), state }]), retry, update });
		await Effect.runPromise(makeService(client, []).retry(Queue, "job-id"));
		expect(retry).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});

	it("maps missing custom client capabilities to operation-specific typed failures", async () => {
		const service = makeService(scriptedClient({}), []);
		for (const [operation, effect] of [
			["counts", service.counts(Queue)],
			["getJob", service.getJob(Queue, "id")],
			["retry", service.retry(Queue, "id")],
		] as const) {
			await expect(Effect.runPromise(effect)).rejects.toMatchObject({ _tag: "PgBossError", operation, queue: Queue.name });
		}
	});
});
