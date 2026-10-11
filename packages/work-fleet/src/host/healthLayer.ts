import { Effect, Layer, Ref } from "effect";
import { fleetHealth } from "@shivaedev/work-board/diagnostics/fleetHealth.ts";
import { Health } from "#engine/health.ts";

export function healthLayer(root: string) {
	return Layer.effect(Health)(
		Effect.gen(function* () {
			const previous = yield* fleetHealth(root).pipe(Effect.option);
			return yield* Ref.make({
				lastCapacityRejection: previous._tag === "Some" ? previous.value.lastCapacityRejection : null,
				lastSchedulerPass: previous._tag === "Some" ? previous.value.lastSchedulerPass : null,
			});
		}),
	);
}
