import { Effect, Layer, Ref, Schema } from "effect";
import { diagnostics as diagnosticsApi } from "@shivaedev/work-board/server/integration/diagnostics.ts";
import { Health } from "#engine/health.ts";
import { ProviderCapacity } from "#session/schema.ts";

const { fleetHealth } = diagnosticsApi;

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
