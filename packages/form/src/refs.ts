import { Equal, Hash, Predicate } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRef from "effect/reactivity/AtomRef";

export function fromRef<TValue>(ref: AtomRef.ReadonlyRef<TValue>): Atom.Atom<TValue> {
	return Atom.readable((get) => {
		get.addFinalizer(ref.subscribe((value) => get.setSelf(value)));
		return ref.value;
	});
}

// Native prop refs retain removed keys; form fields must observe their absence.
export function propertyRef<TValue, TKey extends keyof TValue>(parent: AtomRef.AtomRef<TValue>, name: TKey): AtomRef.AtomRef<TValue[TKey]>;
export function propertyRef(parent: AtomRef.AtomRef<unknown>, name: PropertyKey): AtomRef.AtomRef<unknown>;
export function propertyRef(parent: AtomRef.AtomRef<unknown>, name: PropertyKey): AtomRef.AtomRef<unknown> {
	const read = parent.map((value): unknown => (Predicate.isObjectOrArray(value) ? Reflect.get(value, name) : undefined));
	const ref: AtomRef.AtomRef<unknown> = {
		[AtomRef.TypeId]: AtomRef.TypeId,
		[Equal.symbol]: (other) => Equal.equals(read, other),
		[Hash.symbol]: () => Hash.hash(read),
		key: read.key,
		map: (transform) => read.map(transform),
		prop: (key) => propertyRef(ref, key),
		set: (value) => {
			parent.update((current) => Object.assign(Array.isArray(current) ? current.slice() : {}, current, { [name]: value }));
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
