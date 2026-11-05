import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { activityState } from "#adapters/activityState.ts";
import { clientConnection } from "#adapters/clientConnection.ts";
import { queryCoalesceWindow } from "#queryCoalesceWindow.ts";
import { wrapAtom } from "./wrapAtom.ts";

type ActivityTracker = ReturnType<typeof makeActivity>;
export const clientActivities = new WeakMap<object, ActivityTracker>();

export function makeActivity(factory: Atom.RuntimeFactory) {
	const { activity, change, hold, setConnection } = activityState();
	const connection = clientConnection(factory, setConnection, activity);
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
		const watched = wrapAtom(atom, (get) => {
			get.mount(connection.status);
			get.once(queryCoalesceWindow(watched));
			get.subscribe(queryCoalesceWindow(watched), (duration) => get.set(queryCoalesceWindow(atom), duration), { immediate: true });
			let busy = false;
			let active = true;
			let published = false;
			function observe(result: AsyncResult.AsyncResult<A, E>) {
				if (!active) {
					return;
				}
				const next = result.waiting || AsyncResult.isInitial(result);
				if (busy !== next) {
					busy = next;
					change("refreshingAtoms", next ? 1 : -1);
				}
			}
			get.addFinalizer(() => {
				active = false;
				if (busy) {
					change("refreshingAtoms", -1);
				}
			});
			function publish(result: AsyncResult.AsyncResult<A, E>) {
				published = true;
				observe(result);
				get.setSelf(result);
			}
			// An extra query listener would make abandoned screen work look observed.
			const context = new Proxy(get, { get: (target, key, receiver) => (key === "setSelf" ? publish : Reflect.get(target, key, receiver)) });
			const value = atom.read(context);
			if (!published) {
				observe(value);
			}
			return value;
		});
		return watched;
	}
	return {
		activity: Object.assign(activity, { connectionStatus: connection.status }),
		hint: () => change("liveHints", 1),
		hold: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
			track(
				Effect.acquireUseRelease(
					Effect.sync(hold),
					() => effect,
					(end) => Effect.sync(end),
				),
			),
		queued: () => begin("liveInvalidations"),
		statuses: connection.statuses,
		track,
		watch,
	};
}
