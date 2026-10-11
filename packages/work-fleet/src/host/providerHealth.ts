import { Effect, Layer } from "effect";
import { capacityRejected, Health } from "#engine/health.ts";
import type { SessionFailure, SessionObservation } from "#session/schema.ts";
import { SessionTransport } from "#session/service.ts";

export const providerHealth = Layer.effect(SessionTransport)(
	Effect.gen(function* () {
		const transport = yield* SessionTransport;
		const health = yield* Effect.serviceOption(Health);
		const observed = new Set<string>();
		function remember(key: string) {
			observed.add(key);
			if (observed.size > 1024) {
				const oldest = observed.values().next().value;
				if (oldest !== undefined) {
					observed.delete(oldest);
				}
			}
		}
		function rejected(cause: NonNullable<SessionObservation["capacity"]>) {
			return health._tag === "Some" ? capacityRejected(cause).pipe(Effect.provideService(Health, health.value)) : Effect.void;
		}
		function record<A>(effect: Effect.Effect<A, SessionFailure>) {
			return effect.pipe(Effect.tapError((error) => (error.capacity === undefined ? Effect.void : rejected(error.capacity))));
		}
		return SessionTransport.of({
			...transport,
			observe: (receipt) =>
				record(transport.observe(receipt)).pipe(
					Effect.tap((observation) => {
						const key = `${receipt.sessionId}/${receipt.turnId}`;
						if (observation.capacity === undefined || observed.has(key)) {
							return Effect.void;
						}
						remember(key);
						return rejected(observation.capacity);
					}),
				),
			startSession: (input) => record(transport.startSession(input)),
			startTurn: (input) => record(transport.startTurn(input)),
		});
	}),
);
