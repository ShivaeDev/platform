import * as Atom from "effect/reactivity/Atom";

// Router providers in a registry that have not rendered their first route yet; the first screen is not drawn before they have.
export const firstRoutesPending = Atom.keepAlive(Atom.make(0));
