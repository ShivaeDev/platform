import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { prepareWork } from "#test/engine.ts";
import { running } from "#test/engineState.ts";
import { engine } from "#test/engineStory.ts";
import { nativeStalledTurn } from "#test/nativeStalledTurn.ts";

export function unobservableTurn() {
	return engine.traits(
		nativeStalledTurn(),
		engine.trait("work", "a stall recovery turn disappears from provider observations", function* (state) {
			const fleet = running(state).fleet;
			yield* prepareWork("one").pipe(Effect.provideService(Fleet, fleet));
			yield* fleet.dispatch("one");
			yield* fleet.reconcile("one");
			state.now += 31 * 60_000;
			yield* fleet.reconcile("one");
			state.now += 30 * 60_000;
			yield* fleet.reconcile("one");
			const server = state.recovery.native;
			if (server === undefined || !server.states.has("turn-2")) {
				throw new Error("No recovery turn is available to hide");
			}
			server.hidden.add("turn-2");
		}),
	);
}
