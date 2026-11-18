import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { QuerySignals } from "#querySignals.ts";
import type { QuerySynced, QuerySyncing, QueryUpdate, SubscriptionEvent } from "#queryUpdate.ts";
import type { ReflectionFollower } from "#reflectedStream.ts";

function confirm(update: QuerySyncing | QuerySynced, follower: ReflectionFollower | undefined) {
	if (update._tag === "Syncing") {
		follower?.armed();
	} else {
		follower?.confirmed(update.ids);
	}
}

export function queryDelivery<A, E>(decode: (value: unknown) => A, paused: Atom.Atom<boolean>, signals: Atom.Writable<QuerySignals>) {
	const updates = Atom.make(0);
	const pushed = Atom.make<AsyncResult.AsyncResult<A, E>>(AsyncResult.initial(true));
	const deliver = Effect.fnUntraced(function* (
		update: QueryUpdate,
		follower: ReflectionFollower | undefined,
	): Effect.fn.Return<SubscriptionEvent | undefined, never, AtomRegistry.AtomRegistry> {
		const registry = yield* AtomRegistry.AtomRegistry;
		const showing = !registry.get(paused);
		// A paused screen shows none of what its stream passed, so its confirmations wait for the stream it reopens on resume.
		const shown = showing ? follower : undefined;
		if (update._tag === "Syncing" || update._tag === "Synced") {
			confirm(update, shown);
			return;
		}
		shown?.data();
		registry.update(updates, (current) => current + 1);
		if (update._tag === "Unchanged") {
			if (showing) {
				registry.update(signals, (current) => ({ ...current, completed: current.completed + 1, pending: false }));
			}
			return { _tag: "Delivered" };
		}
		if (update._tag !== "Result") {
			return update;
		}
		if (showing) {
			registry.set(pushed, AsyncResult.success(decode(update.value)));
		}
		return { _tag: "Delivered" };
	});
	return {
		atom: pushed,
		stream: <TError, R>(stream: Stream.Stream<QueryUpdate, TError, R>, follower?: ReflectionFollower) =>
			stream.pipe(
				Stream.mapEffect((update) => deliver(update, follower)),
				Stream.filter((event) => event !== undefined),
			),
		updates,
	};
}
