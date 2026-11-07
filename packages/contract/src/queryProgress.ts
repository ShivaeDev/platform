import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type { LiveStatus } from "#live.ts";
import { type QuerySignals, querySignals, shareQuerySignals } from "#querySignals.ts";
import { wrapAtom } from "#wrapAtom.ts";

export function queryProgress<A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>) {
	const signals = querySignals(atom);
	const tracked = wrapAtom(atom, (get) => {
		get.mount(signals);
		let published = false;
		function publish(result: AsyncResult.AsyncResult<A, E>) {
			published = true;
			get.setSelf(result);
			get.set(signals, recordCompletion(get.once(signals), result));
		}
		const context = new Proxy(get, { get: (target, key, receiver) => (key === "setSelf" ? publish : Reflect.get(target, key, receiver)) });
		const value = atom.read(context);
		if (!published) {
			get.set(signals, recordCompletion(get.once(signals), value));
		}
		return value;
	});
	shareQuerySignals(tracked, atom);
	return tracked;
}

export function recordCompletion<A, E>(current: QuerySignals, result: AsyncResult.AsyncResult<A, E>): QuerySignals {
	const pending = AsyncResult.isInitial(result) || result.waiting;
	return { ...current, completed: current.completed + (pending ? 0 : 1), pending };
}

export function recordSubscription(current: QuerySignals, status: LiveStatus<unknown>): QuerySignals {
	switch (status.connection) {
		case "live":
			return { ...current, subscription: "open" };
		case "failed":
			return { ...current, subscription: "refused" };
		case "connecting":
		case "reconnecting":
			return { ...current, subscription: "opening" };
	}
}
