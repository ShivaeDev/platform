import { Effect } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { LiveStatus } from "#live.ts";

export const retryOnChange = Effect.fnUntraced(function* <E>(status: Atom.Atom<LiveStatus<E>>, keys: readonly string[], restart: () => void) {
	const reactivity = yield* Reactivity.Reactivity;
	const registry = yield* AtomRegistry.AtomRegistry;
	const dispatcher = registry.schedulerAsync.makeDispatcher();
	let active = true;
	function retry() {
		if (active && registry.get(status).connection === "failed") {
			restart();
		}
	}
	function changed() {
		if (registry.get(status).connection === "failed") {
			dispatcher.scheduleTask(retry, 0);
		}
	}
	yield* Effect.acquireRelease(
		Effect.sync(() => reactivity.registerUnsafe(keys, changed)),
		(release) =>
			Effect.sync(() => {
				active = false;
				release();
			}),
	);
});
