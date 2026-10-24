import { Effect } from "effect";
import { SessionFailure } from "#session/schema.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
export function observableBriefSteering(controls: { readonly recordSteer: () => void; readonly failure: () => boolean }) {
	return engineConfiguration("observable brief steering", () => ({
		decorateTransport: (transport) => ({
			...transport,
			steer: (receipt, prompt) =>
				Effect.gen(function* () {
					controls.recordSteer();
					if (controls.failure()) {
						return yield* new SessionFailure({ message: "Steer unavailable", reason: "unavailable" });
					}
					yield* transport.steer?.(receipt, prompt) ?? Effect.die("Missing synthetic steer");
				}),
		}),
		reviewRunning: true,
	}));
}
