import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";

postgresIt(
	"contains a failed retry wake read while completing the other jobs in its batch",
	[realPostgres],
	function* ({ boot, logs, native, observeSettlement, seed, untilJobs }) {
		const queue = defineQueue({
			name: "wake-read-failure",
			queue: { retryLimit: 1 },
			schema: Schema.Struct({ id: Schema.Number }),
		});
		const client = native();
		const probe = observeSettlement(client, { readout: "failed" });
		const handled: number[] = [];
		yield* seed(
			queue,
			[0, 1, 2].map((id) => ({ data: { id }, priority: -id, retryLimit: id === 0 ? 0 : 1 })),
			client,
		);
		yield* boot(
			[
				queue.handle(({ id }) =>
					Effect.suspend(() => {
						handled.push(id);
						return id === 0 ? Effect.fail(new Error("handler failed")) : Effect.void;
					}),
				),
			],
			{ clientFactory: () => probe.client },
		);
		const fetched = yield* probe.fetched;
		expect(fetched.map((job) => job.data)).toEqual(expect.arrayContaining([{ id: 0 }, { id: 1 }, { id: 2 }]));
		expect(fetched.every((job) => job.state === "active")).toBe(true);
		expect((yield* probe.returned).error).toBeUndefined();
		const stored = yield* untilJobs<{ id: number }>(client, queue.name, (jobs) =>
			jobs.every((job) => job.state === "completed" || job.state === "failed"),
		);
		expect(stored.map(({ data, state, retryCount }) => ({ id: data.id, retryCount, state })).sort((left, right) => left.id - right.id)).toEqual([
			{ id: 0, retryCount: 0, state: "failed" },
			{ id: 1, retryCount: 0, state: "completed" },
			{ id: 2, retryCount: 0, state: "completed" },
		]);
		expect(handled).toEqual([0, 1, 2]);
		expect(probe.reads).not.toEqual([]);
		expect(JSON.stringify(logs.filter(({ logLevel }) => logLevel === "Error"))).toContain("retry lookup failed: password=<redacted>");
		expect(JSON.stringify(logs)).not.toContain("wake-secret");
	},
);
