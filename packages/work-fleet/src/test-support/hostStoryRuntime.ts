import { Clock, Effect } from "effect";
import type { HostParts } from "#host/commands.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { readDaemonLayer, scheduledDaemonLayer } from "#test/readDaemon.ts";

export function hostScenarioParts(engine: HostStoryEngine, original: HostParts) {
	const board = engine.board?.(engine.fixture) ?? original.board;
	const policy = engine.policy ?? original.policy;
	return { ...original, ...(board === undefined ? {} : { board }), ...(policy === undefined ? {} : { policy }) };
}
export const diagnosticClock = Effect.fnUntraced(function* (engine: HostStoryEngine) {
	if (engine.diagnosticNow === undefined) {
		return undefined;
	}
	const live = yield* Clock.Clock;
	function now() {
		if (engine.diagnosticNow === undefined) {
			throw new Error("The diagnostic clock is no longer configured");
		}
		return engine.diagnosticNow;
	}
	const clock: Clock.Clock = {
		currentTimeMillis: Effect.sync(now),
		currentTimeMillisUnsafe: now,
		currentTimeNanos: live.currentTimeNanos,
		currentTimeNanosUnsafe: () => live.currentTimeNanosUnsafe(),
		monotonicTimeNanos: live.monotonicTimeNanos,
		monotonicTimeNanosUnsafe: () => live.monotonicTimeNanosUnsafe(),
		sleep: (duration) => live.sleep(duration),
	};
	return clock;
});
export function hostStoryDaemon(
	engine: HostStoryEngine,
	parts: HostParts,
	port: number,
	handlerClock: Clock.Clock | undefined,
	onSnapshot: () => void,
) {
	return engine.scheduled
		? scheduledDaemonLayer(engine.fixture.host, parts)
		: readDaemonLayer(engine.fixture.host, { onSnapshot, ...(handlerClock === undefined ? {} : { handlerClock }), parts, port });
}
