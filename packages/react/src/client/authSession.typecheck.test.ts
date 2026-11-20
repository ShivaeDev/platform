import { Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { expectTypeOf } from "vitest";
import type { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { authSession as readSession } from "@shivaedev/identity/client/adapters/authSession.ts";
import { browserSessionMemory } from "@shivaedev/identity/client/adapters/browserSessionMemory.ts";
import type { RememberedSession } from "@shivaedev/identity/client/SessionMemory.ts";
import { authSession } from "#client/authSession.ts";

interface Session {
	readonly user: { readonly name: string };
}
interface Refused {
	readonly code: "REFUSED";
}
const session = authSession(readSession((_signal) => Promise.resolve<{ data: Session | null; error: Refused | null }>({ data: null, error: null })));
export const atom: Atom.Atom<AsyncResult.AsyncResult<Session | null, Refused | AuthUnavailable>> = session.atom;
export const refresh: Effect.Effect<Session | null, Refused | AuthUnavailable, AtomRegistry.AtomRegistry> = session.refresh;
// @ts-expect-error Refresh needs the registry that owns the session.
export const missingRegistry: Effect.Effect<Session | null, Refused | AuthUnavailable> = session.refresh;
export const provided = session.refresh.pipe(Effect.provideService(AtomRegistry.AtomRegistry, AtomRegistry.make()));

export const permissions = session.refresh.pipe(Effect.map((current) => current?.user.permissions));
expectTypeOf<Effect.Success<typeof permissions>>().toEqualTypeOf<
	readonly { readonly name: string; readonly strength: "own" | "any" }[] | undefined
>();

interface ProviderSession {
	readonly session: { readonly expiresAt: Date; readonly id: string; readonly token: string };
	readonly user: { readonly id: string; readonly name: string };
}
const remembered = authSession(
	readSession((_signal) => Promise.resolve<{ data: ProviderSession | null; error: Refused | null }>({ data: null, error: null })),
	{ remember: browserSessionMemory },
);
export const rememberedAtom: Atom.Atom<AsyncResult.AsyncResult<RememberedSession | null, Refused | AuthUnavailable>> = remembered.atom;
// @ts-expect-error A remembered session carries only what the memory keeps, never the provider's token.
export const rememberedToken = remembered.refresh.pipe(Effect.map((current) => current?.session.token));
const unexpiring = readSession((_signal) => Promise.resolve<{ data: Session | null; error: null }>({ data: null, error: null }));
// @ts-expect-error Remembering needs the provider's session id and expiry.
export const withoutExpiry = authSession(unexpiring, { remember: browserSessionMemory });
