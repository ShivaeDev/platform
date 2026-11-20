import * as Atom from "effect/reactivity/Atom";

const none: ReadonlySet<Atom.Atom<unknown>> = new Set();

export const warmQueries = Atom.keepAlive(Atom.make(none));
