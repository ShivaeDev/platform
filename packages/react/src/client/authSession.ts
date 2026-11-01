import { Effect, Schema } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { PermissionSession } from "#permissions.ts";
import type { AuthActionResult } from "./authAction.ts";

export interface AuthSession<A, E> {
	readonly atom: Atom.Atom<AsyncResult.AsyncResult<A, E | AuthUnavailable>>;
	readonly refresh: Effect.Effect<A, E | AuthUnavailable, AtomRegistry.AtomRegistry>;
}

export type SessionWithPermissions<A> = A extends null ? null : A & PermissionSession;

function decodeSession<A extends { readonly user: object } | null>(data: A): Effect.Effect<SessionWithPermissions<A>, AuthUnavailable>;
function decodeSession(data: { readonly user: object } | null) {
	if (data === null) {
		return Effect.succeed(null);
	}
	return Schema.decodeUnknownEffect(PermissionSession)(data).pipe(
		Effect.map((access) => ({ ...data, user: { ...data.user, ...access.user } })),
		Effect.mapError(() => new AuthUnavailable({ message: "Could not read session permissions" })),
	);
}

export function authSession<A extends { readonly user: object } | null, E extends object = never>(
	read: (signal: AbortSignal) => Promise<AuthActionResult<A, E>>,
): AuthSession<SessionWithPermissions<A>, E> {
	const atom = Atom.make(
		Effect.gen(function* () {
			const result = yield* Effect.tryPromise({
				catch: (cause) => new AuthUnavailable({ message: String(cause) }),
				try: read,
			});
			if (result.error !== null) {
				return yield* Effect.fail(result.error);
			}
			return yield* decodeSession(result.data);
		}),
	);
	const refresh = Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		registry.refresh(atom);
		return yield* AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true });
	});
	return { atom, refresh };
}
