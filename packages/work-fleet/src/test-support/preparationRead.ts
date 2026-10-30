import { Deferred, Effect } from "effect";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { fixedMainSource, MAIN } from "#test/mainSource.ts";

const gates = new WeakMap<HostStoryEngine, { readonly entered: Effect.Effect<void>; readonly release: Effect.Effect<boolean> }>();

export const configurePreparationRead = Effect.fnUntraced(function* (engine: HostStoryEngine) {
	const entered = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	let first = true;
	const current = Effect.gen(function* () {
		if (first) {
			first = false;
			yield* Deferred.succeed(entered, undefined);
			yield* Deferred.await(release);
		}
		return MAIN;
	});
	gates.set(engine, { entered: Deferred.await(entered), release: Deferred.succeed(release, undefined) });
	engine.parts = { ...engine.parts, main: fixedMainSource({ current, refresh: Effect.succeed(MAIN) }) };
});

export function preparationReadVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	function gate() {
		const value = gates.get(engine);
		if (value === undefined) {
			throw new Error("Configure the held preparation read first");
		}
		return value;
	}
	return {
		awaitPreparationRead: () => gate().entered,
		releasePreparationRead: () => {
			tell("release the first preparation's main snapshot");
			return gate().release;
		},
	};
}
