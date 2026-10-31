import { Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { AuthActionResult } from "./authAction.ts";
import { authQuery } from "./authQuery.ts";

export interface AuthSession<A, E> {
	readonly atom: Atom.Atom<AsyncResult.AsyncResult<A, E | AuthUnavailable>>;
	readonly refresh: Effect.Effect<A, E | AuthUnavailable, AtomRegistry.AtomRegistry>;
}

export function authSession<A, E extends object = never>(read: (signal: AbortSignal) => Promise<AuthActionResult<A, E>>): AuthSession<A, E> {
	const atom = authQuery((_: undefined, signal) => read(signal))(undefined);
	const refresh = Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		registry.refresh(atom);
		return yield* AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true });
	});
	return { atom, refresh };
}
