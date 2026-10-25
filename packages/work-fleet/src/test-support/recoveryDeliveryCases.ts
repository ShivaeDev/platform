import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { Fleet } from "#fleet.ts";
import { BASE, HEAD, MOVED, PR } from "#test/githubResult.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { finishRecoveryReview } from "#test/recoverySteps.ts";

export function recoveryDeliveryCases(): readonly RecoveryCase[] {
	let wrongDelivery = true;
	let deliveries = 0;
	function observeDelivery() {
		return Effect.suspend(() => {
			if (wrongDelivery) {
				return Effect.fail(new ServiceUnavailable({ message: "Synthetic delivery unavailable" }));
			}
			deliveries += 1;
			return Effect.succeed({ head: HEAD, revision: HEAD, url: PR });
		});
	}

	return [
		...(["missing", "stale"] as const).map(
			(evidence): RecoveryCase => ({
				code: "pr-head-moved" as const,
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
				recovery: "review-new-head",

				sites: ["engine/observeDeliveryFailure.ts: failureCode(error)", "engine/observeDeliveryFailure.ts: code"],
			}),
		),
		{
			code: "reviewed-pr-ready" as const,
			enter: finishRecoveryReview,
			name: "ready for human merge",
			recovery: "repair-reviewed-pr",
			sites: ['engine/mergeReadiness.ts: "reviewed-pr-ready"'],
		},
		{
			code: "pr-closed" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				yield* finishRecoveryReview(ctx);
				ctx.github.state.status = "CLOSED";
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "closed PR",
			recovery: "adopt-closed-pr-merge",
			restore: (ctx) =>
				Effect.sync(() => {
					ctx.github.state.status = "MERGED";
				}),
			sites: ["engine/observeDeliveryFailure.ts: failureCode(error)", "engine/observeDeliveryFailure.ts: code"],
		},
		{
			code: "fleet-invalid" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				yield* finishRecoveryReview(ctx);
				ctx.github.state.head = MOVED;
				ctx.github.state.paths = ["src/other.ts"];
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "moved head with paths outside the reservation",
			recovery: "review-reserved-paths",
			restore: (ctx) =>
				Effect.sync(() => {
					ctx.github.state.paths = ["src/one.ts"];
				}),
			sites: ["engine/observeDeliveryFailure.ts: failureCode(refreshFailure)"],
		},
		{
			code: "delivery-head-mismatch" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				yield* finishRecoveryReview(ctx);
				const stored = yield* (yield* Fleet).get("one");
				if (stored.value.decision === undefined) {
					return yield* Effect.die("Missing ready decision");
				}
				yield* ctx.fixture.replaceRecord({ ...stored.value, decision: { ...stored.value.decision, code: "delivery-head-mismatch" } });
			}),
			name: "stored delivery head mismatch decision",
			recovery: "adopt-matching-delivery",
			restore: (ctx) =>
				Effect.sync(() => {
					ctx.github.state.status = "MERGED";
				}),
			sites: [],
		},
		{
			code: "fleet-integration" as const,
			enter: finishRecoveryReview,
			name: "delivery integration unavailable",
			observe: () => ({ deliveries }),
			options: { deliveryQuery: observeDelivery },
			recovery: "observe-recovered-delivery",
			restore: () =>
				Effect.sync(() => {
					wrongDelivery = false;
				}),
			sites: ["engine/observeDeliveryFailure.ts: failureCode(error)"],
		},
	];
}
