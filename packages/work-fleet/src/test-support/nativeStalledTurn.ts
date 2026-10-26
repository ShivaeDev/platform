import { Clock, Context, Effect, Layer } from "effect";
import { SessionTransport } from "#session/service.ts";
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
		const services = yield* Layer.build(codexConfiguration(server.endpoint)).pipe(Effect.provideService(Clock.Clock, engineClock));
		const transport = Context.get(services, SessionTransport);
		state.options = { ...state.options, decorateTransport: () => transport };
	});
}
