import { Effect } from "effect";
import type { SessionReceipt } from "#session/schema.ts";
import { SessionFailure } from "#session/schema.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";

export function observableBriefSteering(controls: {
	readonly recordSteer: (receipt: SessionReceipt, prompt: string) => void;
	readonly failure: () => boolean;
}) {
	return (): EngineOptions => ({
		decorateTransport: (transport) => ({
			...transport,
			steer: (receipt, prompt) =>
				Effect.gen(function* () {
					controls.recordSteer(receipt, prompt);
					if (controls.failure()) {
						return yield* new SessionFailure({ message: "Steer unavailable", reason: "unavailable" });
					}
					yield* transport.steer?.(receipt, prompt) ?? Effect.die("Missing synthetic steer");
				}),
		}),
		reviewRunning: true,
	});
}
