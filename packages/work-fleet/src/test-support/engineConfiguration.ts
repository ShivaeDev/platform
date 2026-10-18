import { Effect } from "effect";
import type { EngineOptions } from "#test/EngineOptions.ts";
import type { EngineStory } from "#test/engineState.ts";
import { engine } from "#test/engineStory.ts";

export function engineConfiguration<E = never, R = never>(
	line: string,
	configure: (state: EngineStory) => EngineOptions | Effect.Effect<EngineOptions, E, R>,
) {
	return engine.trait("configuration", line, function* (state) {
		const pending = configure(state);
		const options = Effect.isEffect(pending) ? yield* pending : pending;
		state.options = { ...state.options, ...options };
	});
}
