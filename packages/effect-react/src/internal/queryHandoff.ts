import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";

const handoffs = new WeakMap<AtomRegistry.AtomRegistry, WeakMap<Atom.Atom<unknown>, Set<() => void>>>();

export function keepLoaderQuery(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<unknown>, signal: AbortSignal): () => void {
	let atoms = handoffs.get(registry);
	if (!atoms) {
		atoms = new WeakMap();
		handoffs.set(registry, atoms);
	}
	const readers = atoms.get(atom) ?? new Set<() => void>();
	atoms.set(atom, readers);
	const key = Atom.isSerializable(atom) ? atom[Atom.SerializableTypeId].key : atom;
	if (atom.initialValueTarget && !registry.getNodes().has(key)) {
		// A removed reactive wrapper may have missed invalidations while its source stayed idle.
		registry.refresh(atom);
	}
	const unmount = registry.mount(atom);
	function release() {
		if (readers.delete(release)) {
			signal.removeEventListener("abort", release);
			unmount();
		}
	}
	readers.add(release);
	signal.addEventListener("abort", release, { once: true });
	if (signal.aborted) {
		release();
	}
	return release;
}

export function acceptLoaderQuery(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<unknown>): void {
	for (const release of handoffs.get(registry)?.get(atom) ?? []) {
		release();
	}
}
