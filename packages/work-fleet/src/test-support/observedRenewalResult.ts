import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/contract/errors/taxonomy.ts";
import type { WorkResult } from "#policy.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";

export function observedRenewalResult(result: WorkResult) {
	return engineConfiguration("the open worker PR can change before renewal", (state) => {
		const observation = { unavailable: false, value: result };
		state.resultObservation = observation;
		return {
			denyDelivery: true,
			resultQuery: () =>
				observation.unavailable ? Effect.fail(new ServiceUnavailable({ message: "Ownership unavailable" })) : Effect.succeed(observation.value),
		};
	});
}
