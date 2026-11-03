import { Effect, Schema } from "effect";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { PermissionSession } from "#PermissionSession.ts";
import type { AuthActionResult } from "./authCall.ts";

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

export const authSession = Effect.fnUntraced(function* <A extends { readonly user: object } | null, E extends object = never>(
	read: (signal: AbortSignal) => Promise<AuthActionResult<A, E>>,
): Effect.fn.Return<SessionWithPermissions<A>, E | AuthUnavailable> {
	const result = yield* Effect.tryPromise({
		catch: (cause) => new AuthUnavailable({ message: String(cause) }),
		try: read,
	});
	if (result.error !== null) {
		return yield* Effect.fail(result.error);
	}
	return yield* decodeSession(result.data);
});
