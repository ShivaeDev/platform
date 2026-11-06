import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";

interface Handoff {
	readonly ready: Promise<void>;
	readonly release: () => void;
}

const handoffs = new WeakMap<AtomRegistry.AtomRegistry, WeakMap<Atom.Atom<unknown>, Set<Handoff>>>();

export function keepLoaderQuery(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<unknown>, signal: AbortSignal) {
	let atoms = handoffs.get(registry);
	if (!atoms) {
		atoms = new WeakMap();
		handoffs.set(registry, atoms);
	}
	const readers = atoms.get(atom) ?? new Set<Handoff>();
	atoms.set(atom, readers);
	const unmount = registry.mount(atom);
	const ready = Promise.withResolvers<void>();
	const handoff: Handoff = { ready: ready.promise, release };
	function release() {
		if (readers.delete(handoff)) {
			ready.resolve();
			signal.removeEventListener("abort", release);
			unmount();
		}
	}
	readers.add(handoff);
	signal.addEventListener("abort", release, { once: true });
	if (signal.aborted) {
		release();
	}
	return { complete: release };
}

export function pendingLoaderQuery(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<unknown>): Promise<void> | undefined {
	for (const handoff of handoffs.get(registry)?.get(atom) ?? []) {
		return handoff.ready;
	}
	return undefined;
}
