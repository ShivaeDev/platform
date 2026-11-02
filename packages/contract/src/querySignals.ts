import * as Atom from "effect/reactivity/Atom";

export interface QuerySignals {
	readonly completed: number;
	readonly pending: boolean;
	readonly subscription: "disabled" | "opening" | "open" | "refused";
}

const states = new WeakMap<Atom.Atom<unknown>, Atom.Writable<QuerySignals>>();

export function querySignals(query: Atom.Atom<unknown>): Atom.Writable<QuerySignals> {
	let state = states.get(query);
	if (state === undefined) {
		state = Atom.make<QuerySignals>({ completed: 0, pending: true, subscription: "disabled" });
		states.set(query, state);
	}
	return state;
}

export function shareQuerySignals(query: Atom.Atom<unknown>, source: Atom.Atom<unknown>) {
	states.set(query, querySignals(source));
}
