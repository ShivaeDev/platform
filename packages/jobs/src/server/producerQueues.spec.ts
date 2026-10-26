import { Option, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import { boss } from "#test/boss.ts";

boss.it("registers a producer queue with health and enqueueing but no worker", [], function* ({ boot, client }) {
	const Queue = defineQueue({ name: "producer", queue: { retryLimit: 5 }, schema: Schema.Struct({ id: Schema.NumberFromString }) });
	const runtime = yield* boot([Queue]);
	expect(Option.getOrUndefined(yield* runtime.jobs.enqueue(Queue, { id: 7 }))).toBe("job-id");
	expect(client.sendCalls).toEqual([{ data: { id: "7" }, name: "producer", options: undefined }]);
	expect((yield* runtime.jobs.health).jobs.map(({ name }) => name)).toEqual(["producer"]);
	expect(client.workers).toEqual([]);
	expect(client.createQueueCalls).toEqual([
		{ name: deadLetterQueueName("producer"), options: undefined },
		{ name: "producer", options: { deadLetter: deadLetterQueueName("producer"), retryBackoff: true, retryLimit: 5 } },
	]);
	yield* runtime.stop;
	expect(client.lifecycle).toEqual(["start", "stop"]);
});
