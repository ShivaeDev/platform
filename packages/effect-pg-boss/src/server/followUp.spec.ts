import { Effect, Schema } from "effect";
import { expect, it } from "vitest";
import { defineQueue, defineSchedule } from "#definition.ts";
import { makePgBoss } from "#service.ts";
import { constructorOptions, FakeClient, job } from "#test/fake-client.ts";

it("provides the owning service to a worker during startup after preparing every target queue", async () => {
	const client = new FakeClient();
	const Source = defineQueue({ name: "source", schema: Schema.Struct({}) });
	const Target = defineQueue({ name: "target", schema: Schema.Struct({}) });
	const Jobs = makePgBoss("@test/StartupFollowUp");
	const work = client.work.bind(client);
	client.work = async (name, options, run) => {
		expect(client.queues.has(Target.name)).toBe(true);
		await run([job(name, {})]);
		return work(name, options, run);
	};
	await Effect.runPromise(
		Effect.scoped(
			Effect.asVoid(Jobs).pipe(
				Effect.provide(
					Jobs.layer({
						...constructorOptions,
						clientFactory: () => client,
						jobs: [Source.handle(() => Effect.flatMap(Jobs, (jobs) => jobs.enqueue(Target, {}))), Target],
					}),
				),
			),
		),
	);
	expect(client.sendCalls).toEqual([{ data: expect.any(Object), name: Target.name, options: undefined }]);
	expect(client.startCalls).toBe(1);
	expect(client.stopCalls).toBe(1);
});

it("provides the identical scoped jobs service to scheduled effects", async () => {
	const client = new FakeClient();
	const Jobs = makePgBoss("@test/ScheduledFollowUp");
	const Schedule = defineSchedule({ cron: "0 * * * *", name: "scheduled" });
	const Producer = defineQueue({ name: "producer", schema: Schema.Struct({}) });
	let captured: unknown;
	const scheduled = Schedule.run(
		Effect.gen(function* () {
			const jobs = yield* Jobs;
			captured = jobs;
			yield* jobs.enqueue(Producer, {});
		}),
	);
	const live = Jobs.layer({ ...constructorOptions, clientFactory: () => client, jobs: [scheduled, Producer] });
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const jobs = yield* Jobs;
				yield* Effect.promise(() => client.workers[0]?.run([job(Schedule.name, null)]) ?? Promise.resolve());
				expect(captured).toBe(jobs);
			}).pipe(Effect.provide(live)),
		),
	);
	expect(client.sendCalls).toHaveLength(1);
});
