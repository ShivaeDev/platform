import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { views } from "#engine/views.ts";
import { Fleet } from "#fleet.ts";
import { renderStatus } from "#host/status.ts";
import { executing } from "#model.ts";
import { SessionFailure } from "#session/schema.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const QUEUE_FULL = "Codex rejected the protocol request: App-server request queue is full. Please retry.";
const test = postgresTests("test");

describe("Fleet launch backpressure", () => {
	for (const rejectedCall of ["session", "turn"] as const) {
		test(`a rejected ${rejectedCall} stays queued across restart and later launches`, () => {
			let now = 100;
			let reject = true;
			return withEngine(
				{
					now: () => now,
					submissionFailure: (call) =>
						reject && call === rejectedCall ? new SessionFailure({ message: QUEUE_FULL, reason: "rejected" }) : undefined,
				},
				(fixture) =>
					Effect.gen(function* () {
						yield* prepareWork("one");
						const fleet = yield* Fleet;
						yield* cycle;
						const queued = (yield* fleet.get("one")).value;
						expect(queued.stage).toBe("prepared");
						expect(queued.launchRetry).toEqual({ rejectedAt: 100, rejections: 1, retryAt: 30_100 });
						expect(queued.attempts[0]).toMatchObject({ output: QUEUE_FULL, status: "failed" });
						expect(executing(queued)).toBe(false);
						expect(fixture.decisions).toEqual([]);
						const status = renderStatus(views((yield* fleet.list()).map(({ value }) => value)));
						expect(status).toContain("Active (0)");
						expect(status).toContain("Waiting on automation (1)");
						expect(status).toContain("Waiting for provider capacity; last rejection 1970-01-01T00:00:00.100Z");
						expect(status).toContain("Waiting on maintainer (0)");
						expect(status).toContain("Waiting on orchestrator (0)");
						reject = false;
						now = 30_099;
						yield* fixture.restart(cycle);
						expect(fixture.launched).toHaveLength(1);
						now = 30_100;
						yield* fixture.restart(cycle);
						const accepted = (yield* fleet.get("one")).value;
						expect(accepted.stage).toBe("executing");
						expect(accepted.launchRetry).toBeUndefined();
						expect(accepted.attempts.at(-1)?.receipt).toBeDefined();
						expect(fixture.launched).toHaveLength(rejectedCall === "turn" ? 1 : 2);
						if (rejectedCall === "turn") {
							expect(accepted.attempts.at(-1)?.receipt?.sessionId).toBe(queued.attempts[0]?.sessionId);
						}
						expect(renderStatus(views((yield* fleet.list()).map(({ value }) => value)))).not.toContain("Waiting for provider capacity");
					}),
			);
		});
	}
	test("queue-full stops the pass and holds the backlog through increasing capped backoff", () => {
		let now = 100;
		let reject = true;
		return withEngine(
			{ now: () => now, submissionFailure: () => (reject ? new SessionFailure({ message: QUEUE_FULL, reason: "rejected" }) : undefined) },
			(fixture) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					yield* prepareWork("two");
					const fleet = yield* Fleet;
					for (const delay of [30_000, 60_000, 120_000, 240_000, 300_000, 300_000]) {
						const pass = yield* cycle;
						expect(pass.dispatched).toHaveLength(1);
						const records = (yield* fleet.list()).map(({ value }) => value);
						const retry = records.find((record) => record.launchRetry !== undefined)?.launchRetry;
						expect(retry?.retryAt).toBe(now + delay);
						expect(records.filter((record) => record.attempts.length === 0)).toHaveLength(1);
						const calls = fixture.launched.length;
						now += delay - 1;
						yield* fixture.restart(cycle);
						expect(fixture.launched).toHaveLength(calls);
						now += 1;
					}
					reject = false;
					expect((yield* cycle).dispatched).toHaveLength(2);
					expect((yield* fleet.list()).map(({ value }) => value.stage)).toEqual(["executing", "executing"]);
					expect(fixture.decisions).toEqual([]);
				}),
		);
	});
	test("a permanent rejection reaches needs-human without stopping other launches", () =>
		withEngine({ rejectTurn: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				yield* prepareWork("two");
				const fleet = yield* Fleet;
				expect((yield* cycle).dispatched).toHaveLength(2);
				expect((yield* fleet.get("one")).value).toMatchObject({
					decision: { reason: "Provider rejected turn before acceptance" },
					stage: "needs-human",
				});
				expect((yield* fleet.get("one")).value.launchRetry).toBeUndefined();
				expect(fixture.decisions).toHaveLength(2);
			}),
		));
	test("an ambiguous queue-full message retains ownership without resubmitting", () =>
		withEngine({ submissionFailure: () => new SessionFailure({ message: QUEUE_FULL, reason: "ambiguous" }) }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				const submitted = (yield* fleet.dispatch("one")).value;
				expect(executing(submitted)).toBe(true);
				expect(submitted.launchRetry).toBeUndefined();
				yield* fixture.restart(cycle);
				expect(fixture.launched).toHaveLength(1);
			}),
		));
	test("retry checks current Board context and replaces capacity waiting with the human blocker", () => {
		let now = 100;
		return withEngine({ now: () => now, submissionFailure: () => new SessionFailure({ message: QUEUE_FULL, reason: "rejected" }) }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* cycle;
				fixture.editWork("one", "changed-board");
				now = 30_100;
				yield* fixture.restart(cycle);
				expect((yield* fleet.get("one")).value.launchRetry).toBeUndefined();
				const status = renderStatus(views((yield* fleet.list()).map(({ value }) => value)));
				expect(status).toContain("Waiting on maintainer (1)");
				expect(status).toContain("Work is no longer approved or is done or superseded");
				expect(status).not.toContain("Waiting for provider capacity");
				expect(fixture.launched).toHaveLength(1);
			}),
		);
	});
});
