import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as Reactivity from "effect/reactivity/Reactivity";

interface Batch {
	readonly active: () => boolean;
	readonly seen: Set<() => void>;
}
const batches = new WeakMap<Reactivity.Reactivity, Batch>();

export function invalidateLive(reactivity: Reactivity.Reactivity, keys: readonly string[], active: () => boolean) {
	batches.set(reactivity, { active, seen: new Set() });
	try {
		reactivity.invalidateUnsafe(keys);
	} finally {
		batches.delete(reactivity);
	}
}

export function queryReactivity<R, E>(runtime: Atom.AtomRuntime<R, E>) {
	const service = runtime.atom(Effect.service(Reactivity.Reactivity));
	type Query = Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>;
	const cached = new WeakMap<Query, Query>();
	return (atom: Query, keys: readonly string[]): Query => {
		const existing = cached.get(atom);
		if (existing !== undefined) {
			return existing;
		}
		const source = Atom.setIdleTTL(
			Atom.readable((get) => atom.read(get), atom.refresh),
			0,
		);
		let wrapped = Atom.transform(
			source,
			(get) => {
				const context = get(service);
				if (!AsyncResult.isSuccess(context)) {
					return get(source);
				}
				const reactivity = context.value;
				let pending: (() => boolean) | undefined;
				function invalidate() {
					const batch = batches.get(reactivity);
					if (batch !== undefined) {
						if (batch.seen.has(invalidate)) {
							return;
						}
						batch.seen.add(invalidate);
						if (get.once(source).waiting) {
							pending = batch.active;
							return;
						}
					}
					pending = undefined;
					get.refresh(source);
				}
				get.addFinalizer(reactivity.registerUnsafe(keys, invalidate));
				get.subscribe(source, (value) => {
					get.setSelf(value);
					if (pending !== undefined && !value.waiting) {
						const active = pending;
						pending = undefined;
						if (active()) {
							get.refresh(source);
						}
					}
				});
				return get.once(source);
			},
			{ initialValueTarget: source },
		);
		if (atom.keepAlive) {
			wrapped = Atom.keepAlive(wrapped);
		} else if (atom.idleTTL !== undefined) {
			wrapped = Atom.setIdleTTL(wrapped, atom.idleTTL);
		}
		if (Atom.isSerializable(atom)) {
			Object.assign(wrapped, { [Atom.SerializableTypeId]: atom[Atom.SerializableTypeId] });
		}
		cached.set(atom, wrapped);
		return wrapped;
	};
}
