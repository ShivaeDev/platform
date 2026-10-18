import { Effect } from "effect";
import type { EngineOptions } from "#test/EngineOptions.ts";
import { engine } from "#test/engineStory.ts";

interface Scenario<A> {
	readonly context: A;
	readonly options: EngineOptions;
}

export function engineScenario<A, E = never, R = never>(line: string, setup: () => Scenario<A> | Effect.Effect<Scenario<A>, E, R>) {
	let context: A | undefined;
	return {
		context: () => {
			if (context === undefined) {
				throw new Error(`The scenario has not been seeded: ${line}`);
			}
			return context;
		},
		given: engine.trait("configuration", line, function* (state) {
			const pending = setup();
			const scenario = Effect.isEffect(pending) ? yield* pending : pending;
			context = scenario.context;
			state.options = { ...state.options, ...scenario.options };
		}),
	};
}
