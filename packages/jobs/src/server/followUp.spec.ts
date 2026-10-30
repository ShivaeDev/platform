import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { boss } from "#test/boss.ts";
import { job } from "#test/fakeClient.ts";
import { Jobs } from "#test/pgBossRuntime.ts";

boss.it("provides the owning service to a worker during startup after preparing every target queue", [], function* ({ boot, client }) {
	const Source = defineQueue({ name: "source", schema: Schema.Struct({}) });
	const Target = defineQueue({ name: "target", schema: Schema.Struct({}) });
	const work = client.work.bind(client);
	const prepared: boolean[] = [];
	client.work = async (name, options, run) => {
		prepared.push(client.queues.has(Target.name));
		await run([job(name, {})]);
		return work(name, options, run);
	};
	const runtime = yield* boot([Source.handle(() => Effect.flatMap(Jobs, (jobs) => jobs.enqueue(Target, {}))), Target]);
	yield* runtime.stop;
	expect(prepared).toEqual([true]);
	expect(client.sendCalls).toEqual([{ data: expect.any(Object), name: Target.name, options: undefined }]);
	expect(client.lifecycle).toEqual(["start", "stop"]);
});
