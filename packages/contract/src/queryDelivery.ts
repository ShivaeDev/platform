import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { QuerySignals } from "#querySignals.ts";
import type { QueryUpdate, SubscriptionEvent } from "#queryUpdate.ts";

export function queryDelivery<A, E>(decode: (value: unknown) => A, paused: Atom.Atom<boolean>, signals: Atom.Writable<QuerySignals>) {
	const updates = Atom.make(0);
	const pushed = Atom.make<AsyncResult.AsyncResult<A, E>>(AsyncResult.initial(true));
	const deliver = Effect.fnUntraced(function* (update: QueryUpdate): Effect.fn.Return<SubscriptionEvent, never, AtomRegistry.AtomRegistry> {
		const registry = yield* AtomRegistry.AtomRegistry;
		registry.update(updates, (current) => current + 1);
		if (update._tag === "Unchanged") {
			if (!registry.get(paused)) {
				registry.update(signals, (current) => ({ ...current, completed: current.completed + 1, pending: false }));
			}
			return { _tag: "Delivered" };
		}
		if (update._tag !== "Result") {
			return update;
		}
		if (!registry.get(paused)) {
			registry.set(pushed, AsyncResult.success(decode(update.value)));
		}
		return { _tag: "Delivered" };
	});
	return {
		atom: pushed,
		stream: <TError, R>(stream: Stream.Stream<QueryUpdate, TError, R>) => Stream.mapEffect(stream, deliver),
		updates,
	};
}
