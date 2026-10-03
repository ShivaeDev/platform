import { Equal, Hash } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRef from "effect/unstable/reactivity/AtomRef";

export const fromRef = <A>(ref: AtomRef.ReadonlyRef<A>): Atom.Atom<A> =>
	Atom.readable((get) => {
		get.addFinalizer(ref.subscribe((value) => get.setSelf(value)));
		return ref.value;
	});

// Native prop refs retain removed keys; form fields must observe their absence.
export const propertyRef = <A, K extends keyof A>(parent: AtomRef.AtomRef<A>, name: K): AtomRef.AtomRef<A[K]> => {
	const read = parent.map((value) => value[name]);
	const write = parent.prop(name);
	const ref: AtomRef.AtomRef<A[K]> = {
		[AtomRef.TypeId]: AtomRef.TypeId,
		[Equal.symbol]: (other) => Equal.equals(read, other),
		[Hash.symbol]: () => Hash.hash(read),
		key: read.key,
		map: (transform) => read.map(transform),
		prop: (key) => propertyRef(ref, key),
		set: (value) => {
			write.set(value);
			return ref;
		},
		subscribe: (listener) => read.subscribe(listener),
		update: (transform) => ref.set(transform(read.value)),
		get value() {
			return read.value;
		},
	};
	return ref;
};
