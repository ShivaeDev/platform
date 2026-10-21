import { Equal, Hash } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRef from "effect/reactivity/AtomRef";

export function fromRef<TValue>(ref: AtomRef.ReadonlyRef<TValue>): Atom.Atom<TValue> {
	return Atom.readable((get) => {
		get.addFinalizer(ref.subscribe((value) => get.setSelf(value)));
		return ref.value;
	});
}

// Native prop refs retain removed keys; form fields must observe their absence.
export function propertyRef<TValue, TKey extends keyof TValue>(parent: AtomRef.AtomRef<TValue>, name: TKey): AtomRef.AtomRef<TValue[TKey]> {
	const read = parent.map((value) => value[name]);
	const write = parent.prop(name);
	const ref: AtomRef.AtomRef<TValue[TKey]> = {
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
}
