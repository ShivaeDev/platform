import { Effect } from "effect";
import { answerDelay } from "#test/answerDelay.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { refreshDelay } from "#test/refreshDelay.ts";

interface Delay {
	readonly enable?: () => void;
	readonly entered: Effect.Effect<void>;
	readonly release: Effect.Effect<unknown>;
}
const delays = new WeakMap<HostStoryEngine, Delay>();

export function configureDelayedRefresh(engine: HostStoryEngine, fail = false) {
	engine.beforeStart = Effect.gen(function* () {
		const delay = yield* refreshDelay(engine.fixture, fail);
		delays.set(engine, delay);
		Object.assign(engine.parts, delay.parts);
	});
}

export function configureDelayedAnswer(engine: HostStoryEngine, operation: "steer" | "startTurn" | "archive", fail = false) {
	engine.beforeStart = Effect.gen(function* () {
		const delay = yield* answerDelay(engine.fixture, operation, fail);
		yield* Effect.addFinalizer(() => delay.release);
		delays.set(engine, delay);
		Object.assign(engine.parts, delay.parts);
	});
}

export function hostDelayVerbs(engine: HostStoryEngine) {
	function delay() {
		const value = delays.get(engine);
		if (value === undefined) {
			throw new Error("Configure a delayed command first");
		}
		return value;
	}
	return {
		awaitDelay: () => delay().entered,
		enableDelay: () => {
			const enable = delay().enable;
			if (enable === undefined) {
				throw new Error("This delay is already enabled");
			}
			enable();
		},
		releaseDelay: () => delay().release,
		removeDelay: () => {
			engine.parts = {};
		},
	};
}
