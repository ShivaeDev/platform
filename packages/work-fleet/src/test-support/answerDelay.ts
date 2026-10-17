import { Deferred, Effect, Layer } from "effect";
import { SessionFailure } from "#session/schema.ts";
import { SessionTransport } from "#session/service.ts";
import type { HostFixture } from "#test/fleetHost.ts";

export const answerDelay = Effect.fn("DaemonTest.answerDelay")(function* (
	fixture: HostFixture,
	operation: "steer" | "startTurn" | "archive",
	fail = false,
) {
	const entered = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	let enabled = false;
	function delayed<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return Effect.gen(function* () {
			if (enabled) {
				yield* Deferred.succeed(entered, undefined);
				yield* Deferred.await(release);
				if (fail) {
					return yield* new SessionFailure({ message: "Delayed provider failure", reason: "unavailable" });
				}
			}
			return yield* effect;
		});
	}
	const provider = Layer.effect(SessionTransport)(
		Effect.map(SessionTransport, (transport) => ({
			...transport,
			archive: (id) => (operation === "archive" ? delayed(transport.archive?.(id) ?? Effect.void) : (transport.archive?.(id) ?? Effect.void)),
			startTurn: (input) => (operation === "startTurn" ? delayed(transport.startTurn(input)) : transport.startTurn(input)),
			steer: (receipt, prompt) => delayed(transport.steer?.(receipt, prompt) ?? Effect.void),
		})),
	).pipe(Layer.provide(fixture.parts.provider));
	return {
		enable: () => {
			enabled = true;
		},
		entered: Deferred.await(entered),
		parts: { ...fixture.parts, provider },
		release: Deferred.succeed(release, undefined),
	};
});
