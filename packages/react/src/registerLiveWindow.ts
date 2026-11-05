import { type Duration, Effect } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

interface Windows {
	readonly readers: Map<object, () => void>;
	readonly restore: () => void;
}

const registries = new WeakMap<AtomRegistry.AtomRegistry, WeakMap<Atom.Atom<unknown>, Windows>>();

export const registerLiveWindow = Effect.fn("LiveWindow.registerLiveWindow")(function* <A extends Duration.Input | undefined>(
	atom: Atom.Writable<A>,
	value: A,
) {
	const registry = yield* AtomRegistry.AtomRegistry;
	let windows = registries.get(registry);
	if (windows === undefined) {
		windows = new WeakMap();
		registries.set(registry, windows);
	}
	let current = windows.get(atom);
	if (current === undefined) {
		const original = registry.get(atom);
		current = { readers: new Map(), restore: () => registry.set(atom, original) };
		windows.set(atom, current);
	}
	const reader = {};
	function apply() {
		registry.set(atom, value);
	}
	current.readers.set(reader, apply);
	apply();
	return () => {
		current.readers.delete(reader);
		([...current.readers.values()].at(-1) ?? current.restore)();
		if (current.readers.size === 0) {
			windows.delete(atom);
		}
	};
});
