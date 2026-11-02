import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";

export function atomRemoved(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<unknown>) {
	return new Promise<void>((resolve) => {
		const before = registry.onNodeRemoved;
		registry.onNodeRemoved = (node) => {
			before?.(node);
			if (node.atom === atom) {
				registry.onNodeRemoved = before;
				resolve();
			}
		};
	});
}

export function idleRegistry(registry: AtomRegistry.AtomRegistry) {
	const sentinel = Atom.make(0);
	const swept = atomRemoved(registry, sentinel);
	registry.get(sentinel);
	return swept;
}
