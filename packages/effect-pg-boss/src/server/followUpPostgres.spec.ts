import { Effect, Option, Schema } from "effect";
import { expect, vi } from "vitest";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { defineQueue } from "#definition.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";
import { Jobs } from "#test/pgBossRuntime.ts";

postgresIt("enqueues from both handlers onto worker and producer queues with one scoped client", [realPostgres], function* ({ boot, native }) {
	const Payload = Schema.Struct({ id: Schema.NumberFromString });
	const Source = defineQueue({ name: "source", queue: { notify: true }, schema: Payload });
	const FollowUp = defineQueue({ name: "follow-up", queue: { notify: true }, schema: Payload });
	const Producer = defineQueue({ name: "producer", queue: { notify: true }, schema: Payload });
	const client = native({ useListenNotify: true });
	const factory = vi.fn(() => client);
	const start = vi.spyOn(client, "start");
	const stop = vi.spyOn(client, "stop");
	const completed: number[] = [];
	const runtime = yield* boot(
		[
			Source.handle(({ id: payloadId }) => Effect.flatMap(Jobs, (jobs) => jobs.enqueue(FollowUp, { id: payloadId }))),
			FollowUp.handle(({ id: payloadId }) =>
				Effect.gen(function* () {
					const jobs = yield* Jobs;
					yield* jobs.enqueue(Producer, { id: payloadId });
					completed.push(payloadId);
				}),
			),
			Producer,
		],
		{ clientFactory: factory },
	);
	const id = Option.getOrThrow(yield* runtime.jobs.enqueue(Source, { id: 42 }));
	yield* eventually(
		Effect.promise(async () => {
			const source = (await client.findJobs(Source.name, { id }))[0];
			const followUp = (await client.findJobs(FollowUp.name)).find((job) => job.state === "completed");
			return source?.state === "completed" && followUp !== undefined;
		}).pipe(Effect.filterOrFail(Boolean)),
		{ interval: 50 },
	).pipe(Effect.timeout(15_000));
	expect(completed).toEqual([42]);
	const produced = yield* Effect.promise(() => client.findJobs(Producer.name));
	expect(produced).toHaveLength(1);
	expect(produced[0]?.state).toBe("created");
	const producedId = produced[0]?.id;
	expect(producedId).toBeDefined();
	expect(Option.getOrThrow(yield* runtime.jobs.getJob(Producer, producedId ?? "")).data).toEqual({ id: 42 });
	expect(factory).toHaveBeenCalledTimes(1);
	expect(start).toHaveBeenCalledTimes(1);
	yield* runtime.stop;
	expect(stop).toHaveBeenCalledTimes(1);
});
