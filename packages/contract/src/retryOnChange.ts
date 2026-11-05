import { Cause, Effect, Option, Predicate } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { LiveStatus } from "#live.ts";

export const retryOnChange = Effect.fnUntraced(function* <E>(status: Atom.Atom<LiveStatus<E>>, keys: readonly string[], restart: () => void) {
	const reactivity = yield* Reactivity.Reactivity;
	const registry = yield* AtomRegistry.AtomRegistry;
	const dispatcher = registry.schedulerAsync.makeDispatcher();
	let active = true;
	function canRetry() {
		const current = registry.get(status);
		return (
			current.connection === "failed"
			&& !Option.exists(current.failure, (cause) => Option.exists(Cause.findErrorOption(cause), Predicate.isTagged("QueryReadDenied")))
		);
	}
	function retry() {
		if (active && canRetry()) {
			restart();
		}
	}
	function changed() {
		if (canRetry()) {
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
