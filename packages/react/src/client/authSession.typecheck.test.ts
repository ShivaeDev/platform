import { Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { AuthActionUnavailable } from "./authAction.ts";
import { authSession } from "./authSession.ts";

interface Session {
	readonly user: { readonly name: string };
}
interface Refused {
	readonly code: "REFUSED";
}
const session = authSession((_signal) => Promise.resolve<{ data: Session | null; error: Refused | null }>({ data: null, error: null }));
export const atom: Atom.Atom<AsyncResult.AsyncResult<Session | null, Refused | AuthActionUnavailable>> = session.atom;
export const refresh: Effect.Effect<Session | null, Refused | AuthActionUnavailable, AtomRegistry.AtomRegistry> = session.refresh;
// @ts-expect-error Refresh needs the registry that owns the session.
export const missingRegistry: Effect.Effect<Session | null, Refused | AuthActionUnavailable> = session.refresh;
export const provided = session.refresh.pipe(Effect.provideService(AtomRegistry.AtomRegistry, AtomRegistry.make()));
