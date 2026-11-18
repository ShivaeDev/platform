import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { activityState } from "#adapters/activityState.ts";
import { clientConnection } from "#adapters/clientConnection.ts";
import { wrapAtom } from "#wrapAtom.ts";

type ActivityTracker = ReturnType<typeof makeActivity>;
export const clientActivities = new WeakMap<object, ActivityTracker>();

export function makeActivity(factory: Atom.RuntimeFactory) {
	const { activity, answered, change, hold, setConnection } = activityState();
	const connection = clientConnection(factory, setConnection, activity);
	function begin(key: "rpcCalls" | "commands" | "unreflectedCommands") {
		change(key, 1);
		return () => change(key, -1);
	}
	function track<A, E, R>(effect: Effect.Effect<A, E, R>, command = false) {
		return Effect.acquireUseRelease(
			Effect.sync(() => {
				const endCall = begin("rpcCalls");
				const endCommand = command ? begin("commands") : undefined;
				return () => {
					endCall();
					endCommand?.();
				};
			}),
			() => effect,
			(end) => Effect.sync(end),
		);
	}
	function counter(key: "initialQueries" | "refreshingAtoms") {
		let pending = false;
		function set(next: boolean) {
			if (pending !== next) {
				pending = next;
				change(key, next ? 1 : -1);
			}
		}
		return { release: () => set(false), set };
	}
	function watch<A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>) {
		const watched = wrapAtom(atom, (get) => {
			get.mount(connection.status);
			const refreshing = counter("refreshingAtoms");
			const initial = counter("initialQueries");
			let received = false;
			let active = true;
			let published = false;
			function observe(result: AsyncResult.AsyncResult<A, E>) {
				if (!active) {
					return;
				}
				const first = !(received || AsyncResult.isInitial(result));
				received ||= first;
				initial.set(!received);
				refreshing.set(result.waiting || AsyncResult.isInitial(result));
				if (first) {
					answered();
				}
			}
			get.addFinalizer(() => {
				active = false;
				refreshing.release();
				initial.release();
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
		activity: Object.assign(activity, { connectionStatus: connection.status, firstSettled: connection.firstSettled }),
		hint: () => change("liveHints", 1),
		hold: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
			track(
				Effect.acquireUseRelease(
					Effect.sync(hold),
					() => effect,
					(end) => Effect.sync(end),
				),
				true,
			),
		reflecting: () => begin("unreflectedCommands"),
		statuses: connection.statuses,
		track,
		watch,
	};
}
