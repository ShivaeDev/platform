import { Effect } from "effect";
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
export const read: Effect.Effect<Session | null, Refused | AuthUnavailable> = session;

export const permissions = session.pipe(Effect.map((current) => current?.user.permissions));
expectTypeOf<Effect.Success<typeof permissions>>().toEqualTypeOf<
	readonly { readonly name: string; readonly strength: "own" | "any" }[] | undefined
>();
