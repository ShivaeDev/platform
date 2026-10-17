import { Effect, Layer, Schema } from "effect";
import { PgBoss } from "pg-boss";
import { describe, expect, it } from "vitest";
import { defineQueue } from "#definition.ts";
import { PgBossQueueOptionsError } from "#error.ts";
import { deadLetterQueueName } from "#health.ts";
import { makePgBoss } from "#service.ts";
import { environmentVariable } from "#test/environment.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL") ?? "";
const integration = databaseUrl === "" ? describe.skip : describe;

integration("PostgreSQL queue options", () => {
	it("reconciles an existing queue on restart and rejects immutable changes before updating it", async () => {
		const name = `options-${crypto.randomUUID()}`;
		const Payload = Schema.Struct({});
		const Initial = defineQueue({ name, queue: { expireInSeconds: 10, retryDelayMax: 10, retryLimit: 1 }, schema: Payload });
		const Changed = defineQueue({ name, queue: { expireInSeconds: 45, notify: true, retryDelayMax: 30, retryLimit: 5 }, schema: Payload });
		const Immutable = defineQueue({ name, queue: { expireInSeconds: 60, partition: true, policy: "singleton" }, schema: Payload });
		const options = { connectionString: databaseUrl, schema: "platform_effect_pg_boss" };
		const Jobs = makePgBoss("@test/QueueOptions");
		const observer = new PgBoss(options);
		await observer.start();
		try {
			await Effect.runPromise(Effect.scoped(Layer.build(Jobs.layer({ ...options, jobs: [Initial] }))));
			expect(await observer.getQueue(name)).toMatchObject({ expireInSeconds: 10, retryDelayMax: 10, retryLimit: 1 });
			await Effect.runPromise(Effect.scoped(Layer.build(Jobs.layer({ ...options, jobs: [Changed] }))));
			expect(await observer.getQueue(name)).toMatchObject({ expireInSeconds: 45, notify: true, retryDelayMax: 30, retryLimit: 5 });
			const id = await observer.send(name, {});
			expect(await observer.findJobs(name, { id: id ?? "" })).toMatchObject([{ expireInSeconds: 45, retryDelayMax: 30, retryLimit: 5 }]);
			await expect(Effect.runPromise(Effect.scoped(Layer.build(Jobs.layer({ ...options, jobs: [Immutable] }))))).rejects.toMatchObject({
				_tag: "PgBossQueueOptionsError",
				options: ["partition", "policy"],
				queue: name,
			});
			expect(await observer.getQueue(name)).toMatchObject({ expireInSeconds: 45, partition: false, policy: "standard" });
			expect(new PgBossQueueOptionsError({ options: ["partition", "policy"], queue: name }).message).toContain("partition, policy");
		} finally {
			await observer.deleteQueue(name);
			await observer.deleteQueue(deadLetterQueueName(name));
			await observer.stop();
		}
	});
});
