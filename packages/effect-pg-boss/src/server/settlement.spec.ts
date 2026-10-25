import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue, defineSchedule } from "#definition.ts";
import { boss } from "#test/boss.ts";
import { job } from "#test/fakeClient.ts";
import { scriptedClient } from "#test/scriptedClient.ts";

for (const outcome of ["failure", "defect"] as const) {
	boss.it(`settles scheduled jobs separately after a ${outcome}`, [], function* ({ boot, client, dispatch }) {
		const Schedule = defineSchedule({ cron: "0 * * * *", name: "settle-schedule" });
		const failure = new Error("scheduled poison job");
		let handled = 0;
		const failed = outcome === "failure" ? Effect.fail(failure) : Effect.die(failure);
		const worker = Schedule.run(
			Effect.suspend(() => {
				handled += 1;
				return handled === 2 ? failed : Effect.void;
			}),
		);
		const jobs = Array.from({ length: 10 }, (_, id) => ({ ...job(Schedule.name, null), id: String(id) }));
		yield* boot([worker]);
		yield* dispatch(Schedule.name, jobs);
		expect(handled).toBe(10);
		expect(client.completeCalls.map(({ job: completed }) => completed)).toEqual(jobs.filter((entry) => entry.id !== "1"));
		expect(client.failCalls).toEqual([{ error: failure, job: jobs[1], name: Schedule.name }]);
	});
}

boss.it("allows producer clients without settlement capabilities and fails worker registration with a typed error", [], function* ({ boot }) {
	const { complete: _complete, fail: _fail, ...client } = scriptedClient({ createQueue: async () => undefined, getQueue: async () => null });
	const Queue = defineQueue({ name: "custom-settlement", schema: Schema.Struct({}) });
	const producer = yield* boot([Queue], { clientFactory: () => client });
	yield* producer.stop;
	expect(yield* Effect.flip(boot([Queue.handle(() => Effect.void)], { clientFactory: () => client }))).toMatchObject({
		_tag: "PgBossError",
		operation: "register",
	});
});
