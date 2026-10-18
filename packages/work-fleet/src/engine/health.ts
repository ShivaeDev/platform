import { Clock, Context, Effect, Ref } from "effect";
import type { CapacityRejection, FleetHealth, SourceFailure } from "@shivaedev/work-board/server/integration/diagnostics.ts";
import type { SessionObservation } from "#session/schema.ts";

export interface HealthState {
	readonly lastCapacityRejection: CapacityRejection | null;
	readonly lastSchedulerPass: number | null;
}
export class Health extends Context.Service<Health, Ref.Ref<HealthState>>()("Fleet/Health") {}
export class HealthSnapshot extends Context.Service<HealthSnapshot, Effect.Effect<FleetHealth, SourceFailure>>()("Fleet/HealthSnapshot") {}
export class HealthPublication extends Context.Service<HealthPublication, Effect.Effect<void>>()("Fleet/HealthPublication") {}

export const schedulerPassed = Effect.gen(function* () {
	const health = yield* Effect.serviceOption(Health);
	if (health._tag === "Some") {
		const now = yield* Clock.currentTimeMillis;
		yield* Ref.update(health.value, (state) => ({ ...state, lastSchedulerPass: now }));
	}
	const publication = yield* Effect.serviceOption(HealthPublication);
	if (publication._tag === "Some") {
		yield* publication.value;
	}
});

export const capacityRejected = Effect.fn("Fleet.capacityRejected")(function* (cause: NonNullable<SessionObservation["capacity"]>) {
	const health = yield* Effect.serviceOption(Health);
	if (health._tag === "Some") {
		const now = yield* Clock.currentTimeMillis;
		yield* Ref.update(health.value, (state) => ({ ...state, lastCapacityRejection: { at: now, cause } }));
	}
});
