import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { QuerySignals } from "#querySignals.ts";
import type { QueryUpdate, SubscriptionHint } from "#queryUpdate.ts";

export function queryDelivery<A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	decode: (value: unknown) => A,
	compared: boolean,
	paused: Atom.Atom<boolean>,
	signals: Atom.Writable<QuerySignals>,
) {
	const version = Atom.make(0);
	const pushed = Atom.make<AsyncResult.AsyncResult<A, E>>(AsyncResult.initial());
	const deliver = Effect.fnUntraced(function* (update: QueryUpdate): Effect.fn.Return<SubscriptionHint, never, AtomRegistry.AtomRegistry> {
		if (update._tag === "Unchanged") {
			const registry = yield* AtomRegistry.AtomRegistry;
			if (!registry.get(paused)) {
				registry.update(signals, (current) => ({ ...current, completed: current.completed + 1, pending: false }));
			}
			return { _tag: "Changed", keys: [], queryIndexes: [] };
		}
		if (update._tag !== "Result") {
			return update;
		}
		const registry = yield* AtomRegistry.AtomRegistry;
		if (!registry.get(paused)) {
			registry.set(pushed, AsyncResult.success(decode(update.value)));
			registry.update(version, (current) => current + 1);
		}
		return { _tag: "Changed", keys: [], queryIndexes: [] };
	});
	return {
		atom: compared
			? pushed
			: Atom.readable(
					(get) => {
						const initial = get(pushed);
						return AsyncResult.isInitial(initial) ? get(atom) : initial;
					},
					(refresh) => {
						refresh(atom);
						refresh(pushed);
					},
				),
		stream: <TError, R>(stream: Stream.Stream<QueryUpdate, TError, R>) => Stream.mapEffect(stream, deliver),
		version,
	};
}
