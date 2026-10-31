import { Effect, SubscriptionRef } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type { ClientActivityState } from "#clientActivity.ts";
import { queryCoalesceWindow } from "#queryCoalesceWindow.ts";

type ActivityTracker = ReturnType<typeof makeActivity>;
export const clientActivities = new WeakMap<object, ActivityTracker>();

export function makeActivity() {
	const state = Effect.runSync(SubscriptionRef.make<ClientActivityState>({ liveHints: 0, liveInvalidations: 0, refreshingAtoms: 0, rpcCalls: 0 }));
	const activity = Object.assign(SubscriptionRef.changes(state), { current: SubscriptionRef.get(state) });
	function change(key: keyof ClientActivityState, delta: number) {
		Effect.runSync(SubscriptionRef.update(state, (current) => ({ ...current, [key]: current[key] + delta })));
	}
	function begin(key: "rpcCalls" | "liveInvalidations") {
		change(key, 1);
		return () => change(key, -1);
	}
	function track<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return Effect.acquireUseRelease(
			Effect.sync(() => begin("rpcCalls")),
			() => effect,
			(end) => Effect.sync(end),
		);
	}
	function watch<A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>) {
		let watched = Atom.transform(
			atom,
			(get) => {
				get.once(queryCoalesceWindow(watched));
				get.subscribe(queryCoalesceWindow(watched), (duration) => get.set(queryCoalesceWindow(atom), duration), { immediate: true });
				let busy = false;
				function observe(result: AsyncResult.AsyncResult<A, E>) {
					const next = result.waiting || AsyncResult.isInitial(result);
					if (busy !== next) {
						change("refreshingAtoms", next ? 1 : -1);
						busy = next;
					}
					get.setSelf(result);
				}
				get.addFinalizer(() => {
					if (busy) {
						change("refreshingAtoms", -1);
					}
				});
				get.subscribe(atom, observe);
				const value = get.once(atom);
				observe(value);
				return value;
			},
			{ initialValueTarget: atom },
		);
		if (atom.keepAlive) {
			watched = Atom.keepAlive(watched);
		} else if (atom.idleTTL !== undefined) {
			watched = Atom.setIdleTTL(watched, atom.idleTTL);
		}
		if (Atom.isSerializable(atom)) {
			Object.assign(watched, { [Atom.SerializableTypeId]: atom[Atom.SerializableTypeId] });
		}
		return watched;
	}
	return { activity, hint: () => change("liveHints", 1), queued: () => begin("liveInvalidations"), track, watch };
}
