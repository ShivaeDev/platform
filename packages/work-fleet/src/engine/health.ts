import { Clock, Context, Effect, Ref } from "effect";
import type { CapacityRejection } from "@shivaedev/work-board/diagnostics/health.ts";

export interface HealthState {
	readonly lastCapacityRejection: CapacityRejection | null;
	readonly lastSchedulerPass: number | null;
}
export class Health extends Context.Service<Health, Ref.Ref<HealthState>>()("Fleet/Health") {}

export const schedulerPassed = Effect.gen(function* () {
	const health = yield* Effect.serviceOption(Health);
	if (health._tag === "Some") {
		const now = yield* Clock.currentTimeMillis;
		yield* Ref.update(health.value, (state) => ({ ...state, lastSchedulerPass: now }));
		return true;
	}
	return false;
});

export const capacityRejected = Effect.fn("Fleet.capacityRejected")(function* (cause: string) {
	const health = yield* Effect.serviceOption(Health);
	if (health._tag === "Some") {
		const now = yield* Clock.currentTimeMillis;
		yield* Ref.update(health.value, (state) => ({ ...state, lastCapacityRejection: { at: now, cause: cause.slice(0, 500) } }));
	}
});
