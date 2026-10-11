import { Effect, Layer, Ref, Schema } from "effect";
import { fleetHealth } from "@shivaedev/work-board/diagnostics/fleetHealth.ts";
import { Health } from "#engine/health.ts";
import { ProviderCapacity } from "#session/schema.ts";

export function healthLayer(root: string) {
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
