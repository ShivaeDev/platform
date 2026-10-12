import { Effect, Option, Schema } from "effect";
import { expect, it } from "vitest";
import { defineQueue } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import { makePgBoss } from "#service.ts";
import { constructorOptions, FakeClient } from "#test/fake-client.ts";

it("registers a producer queue with health and enqueueing but no worker", async () => {
	const client = new FakeClient();
	const Queue = defineQueue({ name: "producer", queue: { retryLimit: 5 }, schema: Schema.Struct({ id: Schema.NumberFromString }) });
	const Jobs = makePgBoss("@test/Producer");
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const jobs = yield* Jobs;
				expect(Option.getOrUndefined(yield* jobs.enqueue(Queue, { id: 7 }))).toBe("job-id");
				expect(client.sendCalls).toEqual([{ data: { id: "7" }, name: "producer", options: undefined }]);
				expect((yield* jobs.health).jobs.map(({ name }) => name)).toEqual(["producer"]);
			}).pipe(Effect.provide(Jobs.layer({ ...constructorOptions, clientFactory: () => client, jobs: [Queue] }))),
		),
	);
	expect(client.workers).toEqual([]);
	expect(client.createQueueCalls).toEqual([
		{ name: deadLetterQueueName("producer"), options: undefined },
		{ name: "producer", options: { deadLetter: deadLetterQueueName("producer"), retryBackoff: true, retryLimit: 5 } },
	]);
	expect(client.stopCalls).toBe(1);
});
