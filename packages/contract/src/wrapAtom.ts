import * as Atom from "effect/reactivity/Atom";

export function wrapAtom<A>(atom: Atom.Atom<A>, read: (get: Atom.AtomContext) => A, source: Atom.Atom<A> = atom): Atom.Atom<A> {
	let wrapped = Atom.transform(source, read, { initialValueTarget: source });
	if (atom.keepAlive) {
		wrapped = Atom.keepAlive(wrapped);
	} else if (atom.idleTTL !== undefined) {
		wrapped = Atom.setIdleTTL(wrapped, atom.idleTTL);
	}
	if (Atom.isSerializable(atom)) {
		Object.assign(wrapped, { [Atom.SerializableTypeId]: atom[Atom.SerializableTypeId] });
	}
	return wrapped;
}
