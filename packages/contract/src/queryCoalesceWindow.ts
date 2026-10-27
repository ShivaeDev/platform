import type { Duration } from "effect";
import * as Atom from "effect/reactivity/Atom";

const windows = new WeakMap<Atom.Atom<unknown>, Atom.Writable<Duration.Input | undefined>>();

export function queryCoalesceWindow<A>(query: Atom.Atom<A>): Atom.Writable<Duration.Input | undefined> {
	let window = windows.get(query);
	if (window === undefined) {
		window = Atom.keepAlive(Atom.make<Duration.Input | undefined>(undefined));
		windows.set(query, window);
	}
	return window;
}
