import { Deferred, Effect } from "effect";
import type { FleetRecord } from "#model.ts";
import { codexAdapter } from "#providers/codexAdapter.ts";
import { engine } from "#test/engineStory.ts";

export function unacknowledgedSession(retirementRace = false) {
	return engine.trait("configuration", "the provider withholds its session acknowledgement", function* (state) {
		const gates = {
			commit: yield* Deferred.make<void>(),
			retiring: yield* Deferred.make<void>(),
			session: yield* Deferred.make<void>(),
			turn: yield* Deferred.make<void>(),
		};
		state.recovery.gates = gates;
		const native = codexAdapter(() => Effect.die("Unacknowledged recovery must not call the provider"), {
			beforeTurn: () => Effect.succeed({}),
			provisioning: "unknown",
			threadStart: () => ({}),
		});
		function writeGate(value: FleetRecord) {
			if (value.step !== "waiting" || value.attempts[0]?.status !== "failed") {
				return Effect.void;
			}
			return Deferred.succeed(gates.retiring, undefined).pipe(Effect.andThen(Deferred.await(gates.commit)));
		}
		state.options = {
			...state.options,
			decorateTransport: (transport) => {
				const startTurn = retirementRace
					? (input: Parameters<typeof transport.startTurn>[0]) =>
							transport.startTurn(input).pipe(Effect.tap(() => Deferred.succeed(gates.turn, undefined)))
					: transport.startTurn;
				return { ...transport, reconcile: native.reconcile, startTurn };
			},
			sessionAcknowledgementGate: Deferred.await(gates.session),
			...(retirementRace ? { writeGate } : {}),
		};
	});
}
