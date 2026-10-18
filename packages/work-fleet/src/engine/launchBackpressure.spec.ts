import { describe, expect } from "@effect/vitest";
import { views } from "#engine/views.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { executing } from "#model.ts";
import { ambiguousProviderRejection, permanentProviderRejection, providerCapacityRejected } from "#test/engineCapacityTraits.ts";
import { engine } from "#test/engineStory.ts";

const QUEUE_FULL = "Codex rejected the protocol request: App-server request queue is full. Please retry.";
describe("Fleet launch backpressure", () => {
	for (const rejectedCall of ["session", "turn"] as const) {
		engine.it(
			`a rejected ${rejectedCall} stays queued across restart and later launches`,
			[providerCapacityRejected(rejectedCall)],
			function* (fleet) {
				yield* fleet.prepareWork("one");
				yield* fleet.schedule();
				const queued = (yield* fleet.get("one")).value;
				expect(queued.stage).toBe("prepared");
				expect(queued.launchRetry).toEqual({ rejectedAt: 100, rejections: 1, retryAt: 30_100 });
				expect(queued.attempts[0]).toMatchObject({ output: QUEUE_FULL, status: "failed" });
				expect(executing(queued)).toBe(false);
				expect(fleet.publishedDecisions()).toEqual([]);
				const status = renderStatus(views((yield* fleet.list()).map(({ value }) => value)));
				expect(status).toContain("Active (0)");
				expect(status).toContain("Waiting on automation (1)");
				expect(status).toContain("Waiting for provider capacity; last rejection 1970-01-01T00:00:00.100Z");
				expect(status).toContain("Waiting on maintainer (0)");
				expect(status).toContain("Waiting on orchestrator (0)");
				fleet.recoverProvider();
				fleet.advanceTime(30_099 - fleet.currentTime());
				yield* fleet.restart();
				yield* fleet.schedule();
				expect(fleet.launches()).toHaveLength(1);
				fleet.advanceTime(30_100 - fleet.currentTime());
				yield* fleet.restart();
				yield* fleet.schedule();
				const accepted = (yield* fleet.get("one")).value;
				expect(accepted.stage).toBe("executing");
				expect(accepted.launchRetry).toBeUndefined();
				expect(accepted.attempts.at(-1)?.receipt).toBeDefined();
				expect(fleet.launches()).toHaveLength(rejectedCall === "turn" ? 1 : 2);
				if (rejectedCall === "turn") {
					expect(accepted.attempts.at(-1)?.receipt?.sessionId).toBe(queued.attempts[0]?.sessionId);
				}
				expect(renderStatus(views((yield* fleet.list()).map(({ value }) => value)))).not.toContain("Waiting for provider capacity");
			},
		);
	}
	engine.it("queue-full stops the pass and holds the backlog through bounded increasing backoff", [providerCapacityRejected()], function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.prepareWork("two");
		for (const delay of [30_000, 60_000, 120_000, 240_000]) {
			const pass = yield* fleet.schedule();
			expect(pass.dispatched).toHaveLength(1);
			const records = (yield* fleet.list()).map(({ value }) => value);
			const retry = records.find((record) => record.launchRetry !== undefined)?.launchRetry;
			expect(retry?.retryAt).toBe(fleet.currentTime() + delay);
			expect(records.filter((record) => record.attempts.length === 0)).toHaveLength(1);
			const calls = fleet.launches().length;
			fleet.advanceTime(delay - 1);
			yield* fleet.restart();
			yield* fleet.schedule();
			expect(fleet.launches()).toHaveLength(calls);
			fleet.advanceTime(1);
		}
		fleet.recoverProvider();
		expect((yield* fleet.schedule()).dispatched).toHaveLength(2);
		expect((yield* fleet.list()).map(({ value }) => value.stage)).toEqual(["executing", "executing"]);
		expect(fleet.publishedDecisions()).toEqual([]);
	});
	engine.it("a permanent rejection reaches needs-human without stopping other launches", [permanentProviderRejection()], function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.prepareWork("two");
		expect((yield* fleet.schedule()).dispatched).toHaveLength(2);
		expect((yield* fleet.get("one")).value).toMatchObject({
			decision: { code: "session-rejected", reason: QUEUE_FULL },
			stage: "needs-human",
		});
		expect((yield* fleet.get("one")).value.launchRetry).toBeUndefined();
		expect(fleet.publishedDecisions()).toHaveLength(2);
	});
	engine.it("an ambiguous queue-full message retains ownership without resubmitting", [ambiguousProviderRejection()], function* (fleet) {
		yield* fleet.prepareWork("one");
		const submitted = (yield* fleet.dispatch("one")).value;
		expect(executing(submitted)).toBe(true);
		expect(submitted.launchRetry).toBeUndefined();
		yield* fleet.restart();
		yield* fleet.schedule();
		expect(fleet.launches()).toHaveLength(1);
	});
	engine.it(
		"retry checks current Board context and replaces capacity waiting with the human blocker",
		[providerCapacityRejected()],
		function* (fleet) {
			yield* fleet.prepareWork("one");
			yield* fleet.schedule();
			fleet.editWork("one", "changed-board");
			fleet.advanceTime(30_100 - fleet.currentTime());
			yield* fleet.restart();
			yield* fleet.schedule();
			expect((yield* fleet.get("one")).value.launchRetry).toBeUndefined();
			const status = renderStatus(views((yield* fleet.list()).map(({ value }) => value)));
			expect(status).toContain("Waiting on maintainer (1)");
			expect(status).toContain("Work is no longer approved");
			expect(status).not.toContain("Waiting for provider capacity");
			expect(fleet.launches()).toHaveLength(1);
		},
	);
});
