import { Clock, Effect, Layer } from "effect";
import { codexConfiguration } from "#test/codex.ts";
import { engine } from "#test/engineStory.ts";
import { stalledCodex } from "#test/stalledCodex.ts";

export function nativeStalledTurn(delayInterrupt = false) {
	return engine.trait("configuration", "Codex runs a turn whose progress can stall", function* (state) {
		const server = yield* stalledCodex(delayInterrupt);
		state.recovery.native = server;
		state.now = 0;
		const clock = yield* Clock.Clock;
		const engineClock: Clock.Clock = {
			currentTimeMillis: Effect.sync(() => state.now),
			currentTimeMillisUnsafe: () => state.now,
			currentTimeNanos: clock.currentTimeNanos,
			currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
			monotonicTimeNanos: clock.monotonicTimeNanos,
			monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
			sleep: (duration) => clock.sleep(duration),
		};
		state.options = {
			...state.options,
			transportLayer: codexConfiguration(server.endpoint).pipe(Layer.provide(Layer.succeed(Clock.Clock)(engineClock)), Layer.orDie),
		};
	});
}
