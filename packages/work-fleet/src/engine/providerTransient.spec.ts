import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { executing } from "#model.ts";
import { SessionFailure } from "#session/schema.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test");
const MESSAGE = "Selected model is at capacity";

for (const structured of [false, true]) {
	test(`capacity clears on retry after restart: structured=${structured}`, () => {
		let now = 100;
		let rejected = true;
		return withEngine(
			{
				now: () => now,
				submissionFailure: () =>
					rejected
						? new SessionFailure({ ...(structured ? { capacity: "serverOverloaded" } : {}), message: MESSAGE, reason: "rejected" })
						: undefined,
			},
			(fixture) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					yield* cycle;
					const queued = (yield* fleet.get("one")).value;
					expect(queued.stage).toBe("prepared");
					expect(queued.launchRetry).toEqual({ rejectedAt: 100, rejections: 1, retryAt: 30_100 });
					expect(executing(queued)).toBe(false);
					expect(fixture.decisions).toHaveLength(0);
					rejected = false;
					now = 30_099;
					yield* fixture.restart(cycle);
					expect(fixture.launched).toHaveLength(1);
					now = 30_100;
					yield* fixture.restart(cycle);
					expect((yield* fleet.get("one")).value).toMatchObject({ stage: "executing" });
					expect((yield* fleet.get("one")).value.launchRetry).toBeUndefined();
					expect(fixture.launched).toHaveLength(2);
				}),
		);
	});
}

test("capacity that never clears parks after five attempts across restarts", () => {
	let now = 100;
	return withEngine({ now: () => now, submissionFailure: () => new SessionFailure({ message: MESSAGE, reason: "rejected" }) }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			for (const delay of [30_000, 60_000, 120_000, 240_000]) {
				yield* fixture.restart(cycle);
				const queued = (yield* fleet.get("one")).value;
				expect(queued.launchRetry?.retryAt).toBe(now + delay);
				expect(queued.decision).toBeUndefined();
				now += delay;
			}
			yield* fixture.restart(cycle);
			const parked = (yield* fleet.get("one")).value;
			expect(parked.stage).toBe("needs-human");
			expect(parked.launchRetry).toBeUndefined();
			expect(parked.decision?.reason).toBe(`${MESSAGE}; provider failure after 5 attempts (4 automatic retries)`);
			expect(parked.attempts).toHaveLength(5);
			expect(executing(parked)).toBe(false);
			now += 1_000_000;
			yield* fixture.restart(cycle);
			expect(fixture.launched).toHaveLength(5);
			expect(fixture.decisions).toHaveLength(1);
		}),
	);
});

for (const rejection of ["Rejected credential", "Request refused by policy"]) {
	test(`${rejection} remains a human blocker`, () =>
		withEngine({ submissionFailure: () => new SessionFailure({ message: rejection, reason: "rejected" }) }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* cycle;
				expect((yield* fleet.get("one")).value).toMatchObject({ decision: { reason: rejection }, stage: "needs-human" });
				expect((yield* fleet.get("one")).value.launchRetry).toBeUndefined();
				yield* fixture.restart(cycle);
				expect(fixture.launched).toHaveLength(1);
			}),
		));
}

for (const rejection of ["turn already active for thread", "Codex rejected the protocol request: turn already active for thread"]) {
	test(`busy rejection queues a fresh thread automatically: ${rejection}`, () => {
		let now = 100;
		let reject = true;
		return withEngine(
			{
				now: () => now,
				submissionFailure: (call) => (reject && call === "turn" ? new SessionFailure({ message: rejection, reason: "rejected" }) : undefined),
			},
			(fixture) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					yield* cycle;
					const queued = (yield* fleet.get("one")).value;
					expect(queued.stage).toBe("prepared");
					expect(queued.attempts.at(-1)?.sessionUnusable).toBe(true);
					expect(fixture.decisions).toHaveLength(0);
					reject = false;
					now = 30_100;
					yield* fixture.restart(cycle);
					const accepted = (yield* fleet.get("one")).value;
					expect(accepted.stage).toBe("executing");
					expect(accepted.attempts.at(-1)?.receipt?.sessionId).not.toBe(queued.attempts.at(-1)?.sessionId);
					expect(fixture.starts.at(-1)?.prompt).toContain("same branch and PR");
					expect(fixture.launched).toHaveLength(2);
				}),
		);
	});
}
