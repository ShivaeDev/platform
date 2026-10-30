import { Effect, Layer, Ref, Schema, SubscriptionRef } from "effect";
import { diagnostics as diagnosticsApi } from "@shivaedev/work-board/server/integration/diagnostics.ts";
import { Health, SchedulerPasses } from "#engine/health.ts";
import { ProviderCapacity } from "#session/schema.ts";

const { fleetHealth } = diagnosticsApi;

export function healthLayer(root: string) {
	return Layer.merge(restoredHealth(root), Layer.effect(SchedulerPasses)(SubscriptionRef.make(0)));
}

function restoredHealth(root: string) {
	return Layer.effect(Health)(
		Effect.gen(function* () {
			const previous = yield* fleetHealth(root).pipe(Effect.option);
			const rejection = previous._tag === "Some" ? previous.value.lastCapacityRejection : null;
			return yield* Ref.make({
				lastCapacityRejection: rejection !== null && Schema.decodeUnknownOption(ProviderCapacity)(rejection.cause)._tag === "Some" ? rejection : null,
				lastSchedulerPass: previous._tag === "Some" ? previous.value.lastSchedulerPass : null,
			});
		}),
	);
}
