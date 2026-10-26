import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { prepareWork } from "#test/engine.ts";
import { running } from "#test/engineState.ts";
import { engine } from "#test/engineStory.ts";
import { nativeStalledTurn } from "#test/nativeStalledTurn.ts";

export function unobservableTurn() {
	return engine.traits(
		nativeStalledTurn(),
		engine.trait("work", "the worker's acknowledged turn disappears from provider observations", function* (state) {
			const fleet = running(state).fleet;
			yield* prepareWork("one").pipe(Effect.provideService(Fleet, fleet));
			yield* fleet.dispatch("one");
			yield* fleet.reconcile("one");
			const server = state.recovery.native;
			if (server === undefined || !server.states.has("turn-1")) {
				throw new Error("No acknowledged turn is available to hide");
			}
			server.hidden.add("turn-1");
		}),
	);
}
