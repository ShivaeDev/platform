import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { MOVED_PR_HEAD_REASON } from "#host/movedPrHead.ts";
import { FleetFailure } from "#policy.ts";
import { BASE, HEAD, MOVED, PR } from "#test/githubResult.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { finishRecoveryReview } from "#test/recoverySteps.ts";

export function recoveryDeliveryCases(): readonly RecoveryCase[] {
	let wrongDelivery = true;
	let deliveries = 0;
	function observeDelivery() {
		return Effect.suspend(() => {
			if (wrongDelivery) {
				return Effect.fail(new FleetFailure({ message: "Synthetic delivery unavailable", reason: "integration" }));
			}
			deliveries += 1;
			return Effect.succeed({ head: HEAD, revision: HEAD, url: PR });
		});
	}

	return [
		...(["missing", "stale"] as const).map(
			(evidence): RecoveryCase => ({
				enter: Effect.fnUntraced(function* (ctx) {
					yield* finishRecoveryReview(ctx);
					const fleet = yield* Fleet;
					const stored = yield* fleet.get("one");
					if (stored.value.review === undefined) {
						return yield* Effect.die("Missing review");
					}
					yield* ctx.fixture.replaceRecord({ ...stored.value, review: evidence === "missing" ? undefined : { ...stored.value.review, head: BASE } });
					ctx.github.state.head = MOVED;
					yield* fleet.reconcile("one");
				}),
				name: `base merged into PR with ${evidence} prior review evidence`,
				progress: (ctx, before, after) => {
					expect(after.result?.head).toBe(MOVED);
					expect(after.resultObservations).toContainEqual(before.result);
					expect(after.attempts.length).toBeGreaterThan(before.attempts.length);
					expect(after.attempts.at(-1)).toMatchObject({ reviewHead: MOVED, role: "reviewer", status: "running" });
					expect(after.attempts.at(-1)?.receipt?.sessionId).not.toBe(before.attempts.at(-1)?.receipt?.sessionId);
					expect(after.checks).toBeUndefined();
					expect(after.mergeReadyAt).toBeUndefined();
					expect(ctx.fixture.reviews).toEqual([HEAD, MOVED]);
				},
				reason: MOVED_PR_HEAD_REASON,
				sites: ["engine/makeDeliver.ts: observed.failure.message", "engine/makeDeliver.ts: reason"],
			}),
		),
		{
			enter: finishRecoveryReview,
			name: "ready for human merge",
			progress: (_ctx, before, after) => {
				expect(after.stage).toBe("executing");
				expect(after.attempts.at(-1)).toMatchObject({ role: "repair", sessionId: before.attempts[0]?.receipt?.sessionId });
				expect(after.attempts.at(-1)?.prompt).toContain("Resolve the report decision.");
				expect(after.result).toEqual(before.result);
				expect(after.review).toBeUndefined();
				expect(after.checks).toBeUndefined();
			},
			reason: "Reviewed PR is ready to merge",
			sites: ['engine/mergeReadiness.ts: "Reviewed PR is ready to merge"'],
		},
		{
			enter: Effect.fnUntraced(function* (ctx) {
				yield* finishRecoveryReview(ctx);
				ctx.github.state.status = "CLOSED";
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "closed PR",
			progress: (_ctx, before, after) => {
				expect(after.stage).toBe("completed");
				expect(after.attempts.map((attempt) => attempt.operationId)).toEqual(before.attempts.map((attempt) => attempt.operationId));
			},
			reason: "PR was closed without merging; inspect the closed PR before retrying or releasing this work",
			restore: (ctx) =>
				Effect.sync(() => {
					ctx.github.state.status = "MERGED";
				}),
			sites: ["engine/makeDeliver.ts: observed.failure.message", "engine/makeDeliver.ts: reason"],
		},
		{
			enter: Effect.fnUntraced(function* (ctx) {
				yield* finishRecoveryReview(ctx);
				ctx.github.state.head = MOVED;
				ctx.github.state.paths = ["src/other.ts"];
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "moved head with paths outside the reservation",
			progress: (_ctx, before, after) => {
				expect(after.result?.head).toBe(MOVED);
				expect(after.attempts.length).toBeGreaterThan(before.attempts.length);
				expect(after.attempts.at(-1)).toMatchObject({ reviewHead: MOVED, role: "reviewer" });
			},
			reason: "Result needs evidence and known reserved scope",
			restore: (ctx) =>
				Effect.sync(() => {
					ctx.github.state.paths = ["src/one.ts"];
				}),
			sites: ["engine/makeDeliver.ts: error.message"],
		},
		{
			enter: finishRecoveryReview,
			name: "delivery differs from reviewed head",
			options: {
				deliveryQuery: () =>
					Effect.sync(() => {
						deliveries += 1;
						return { head: wrongDelivery ? MOVED : HEAD, revision: HEAD, url: PR };
					}),
			},
			progress: (_ctx, before, after) => {
				expect(deliveries).toBeGreaterThan(1);
				expect(after.stage).toBe("completed");
				expect(after.attempts.map((attempt) => attempt.operationId)).toEqual(before.attempts.map((attempt) => attempt.operationId));
			},
			reason: "Delivered revision differs from reviewed head",
			restore: () =>
				Effect.sync(() => {
					wrongDelivery = false;
				}),
			sites: ['engine/makeDeliver.ts: "Delivered revision differs from reviewed head"'],
		},
		{
			enter: finishRecoveryReview,
			name: "delivery integration unavailable",
			options: { deliveryQuery: observeDelivery },
			progress: (_ctx, _before, after) => {
				expect(deliveries).toBe(1);
				expect(after.stage).toBe("completed");
			},
			reason: "Synthetic delivery unavailable",
			restore: () =>
				Effect.sync(() => {
					wrongDelivery = false;
				}),
			sites: ["engine/makeDeliver.ts: observed.failure.message"],
		},
	];
}
