import { Clock, Effect, Layer } from "effect";
import { DiagnosticsSources } from "@shivaedev/work-board/diagnostics/source.ts";
import type { HostParts } from "#host/commands.ts";
import { daemonLayer } from "#host/daemon.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { readDaemonLayer } from "#test/readDaemon.ts";

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
	const layer = engine.scheduled
		? daemonLayer(engine.fixture.host, parts, port)
		: readDaemonLayer(engine.fixture.host, { onSnapshot, ...(handlerClock === undefined ? {} : { handlerClock }), parts, port });
	return engine.diagnostics === undefined ? layer : layer.pipe(Layer.provide(Layer.succeed(DiagnosticsSources, engine.diagnostics)));
}
