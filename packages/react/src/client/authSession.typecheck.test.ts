import { Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { expectTypeOf } from "vitest";
import type { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { authSession } from "./authSession.ts";

interface Session {
	readonly user: { readonly name: string };
}
interface Refused {
	readonly code: "REFUSED";
}
const session = authSession((_signal) => Promise.resolve<{ data: Session | null; error: Refused | null }>({ data: null, error: null }));
export const atom: Atom.Atom<AsyncResult.AsyncResult<Session | null, Refused | AuthUnavailable>> = session.atom;
export const refresh: Effect.Effect<Session | null, Refused | AuthUnavailable, AtomRegistry.AtomRegistry> = session.refresh;
// @ts-expect-error Refresh needs the registry that owns the session.
export const missingRegistry: Effect.Effect<Session | null, Refused | AuthUnavailable> = session.refresh;
export const provided = session.refresh.pipe(Effect.provideService(AtomRegistry.AtomRegistry, AtomRegistry.make()));

export const permissions = session.refresh.pipe(Effect.map((current) => current?.user.permissions));
expectTypeOf<Effect.Success<typeof permissions>>().toEqualTypeOf<
	readonly { readonly name: string; readonly strength: "own" | "any" }[] | undefined
>();
