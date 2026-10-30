import { Duration, Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { queryCoalesceWindow } from "#queryCoalesceWindow.ts";
import { liveBatches, liveKeys } from "./liveInvalidation.ts";

export function queryReactivity<R, E>(runtime: Atom.AtomRuntime<R, E>) {
	const service = runtime.atom(Effect.service(Reactivity.Reactivity));
	type Query = Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>;
	const cached = new WeakMap<Query, Query>();
	return (atom: Query, keys: readonly string[], owner?: AtomRegistry.AtomRegistry): Query => {
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
				if (owner !== undefined && owner !== get.registry) {
					throw new Error("A session-scoped query belongs to its binding registry");
				}
				const context = get(service);
				if (!AsyncResult.isSuccess(context)) {
					return get(source);
				}
				const reactivity = context.value;
				let pending: (() => boolean) | undefined;
				let scheduled = false;
				const timer = runtime.fn(({ delay, active }: { readonly delay: number; readonly active: () => boolean }) =>
					Effect.andThen(
						Effect.sleep(delay),
						Effect.sync(() => {
							scheduled = false;
							refresh(active);
						}),
					),
				);
				get.mount(timer);
				function clear() {
					get.set(timer, Atom.Interrupt);
					scheduled = false;
					pending = undefined;
				}
				function refresh(active: () => boolean) {
					if (!active()) {
						return;
					}
					if (get.once(source).waiting) {
						pending = active;
					} else {
						pending = undefined;
						get.refresh(source);
					}
				}
				function changed() {
					const batch = liveBatches.get(reactivity);
					if (batch === undefined || batch.seen.has(changed)) {
						return;
					}
					batch.seen.add(changed);
					const delay = Duration.toMillis(Duration.fromInputUnsafe(get.once(queryCoalesceWindow(wrapped)) ?? batch.window ?? 0));
					if (delay === 0) {
						clear();
						get.refresh(source);
					} else if (!scheduled) {
						scheduled = true;
						get.set(timer, { active: batch.active, delay });
					}
				}
				get.addFinalizer(clear);
				get.addFinalizer(reactivity.registerUnsafe(liveKeys(keys), changed));
				get.addFinalizer(
					reactivity.registerUnsafe(keys, () => {
						if (!liveBatches.has(reactivity)) {
							clear();
							get.refresh(source);
						}
					}),
				);
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
