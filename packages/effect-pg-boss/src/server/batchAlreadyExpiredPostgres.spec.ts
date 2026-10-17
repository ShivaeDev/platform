import { setImmediate } from "node:timers/promises";
import { Clock, Effect } from "effect";
import { PgBoss } from "pg-boss";
import { describe, expect, it, vi } from "vitest";
import { batchHandler } from "#internal/batchHandler.ts";
import { environmentVariable } from "#test/environment.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL") ?? "";
const integration = databaseUrl === "" ? describe.skip : describe;

integration("PostgreSQL already expired batch", () => {
	it("does not start or settle a fetched job whose window passed before the callback", async () => {
		const name = `already-expired-${crypto.randomUUID()}`;
		const client = new PgBoss({ connectionString: databaseUrl, schema: "platform_effect_pg_boss", supervise: false });
		const handled = vi.fn();
		const returned = vi.fn();
		await client.start();
		try {
			await client.createQueue(name, { expireInSeconds: 1, retryLimit: 0 });
			await client.send(name, {});
			const fetched = await client.fetch(name, { includeMetadata: true });
			const first = fetched[0];
			expect(first).toBeDefined();
			if (first === undefined) {
				throw new Error("Expected a fetched job");
			}
			const deadline = first.startedOn.getTime() + first.expireInSeconds * 1000;
			const now = await Effect.runPromise(Clock.currentTimeMillis);
			await Effect.runPromise(Effect.sleep(Math.max(0, deadline - now) + 50));
			const jobs = fetched.map((job) => ({ ...job, signal: new AbortController().signal }));
			batchHandler(client, name, () => Effect.sync(handled))(jobs).then(returned, returned);
			await setImmediate();
			expect(handled).not.toHaveBeenCalled();
			expect(returned).not.toHaveBeenCalled();
			expect((await client.findJobs(name)).some((job) => job.state === "completed")).toBe(false);
		} finally {
			await client.deleteQueue(name);
			await client.stop();
		}
	});
});
