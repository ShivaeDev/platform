import { type Context, Effect, Layer, Option } from "effect";
import type { RpcMiddleware } from "effect/rpc";
import type { Permission } from "@shivaedev/access/permission.ts";
import { forbidden } from "@shivaedev/access/refusal.ts";
import { requirePermission } from "@shivaedev/access/requirePermission.ts";
import { Identity, SessionUser } from "#identity.ts";
import type { IdentityFailures } from "#middleware.ts";
import { hasPermission } from "#permission.ts";
import { recheckSession } from "./recheckSession.ts";
import { revalidateStream } from "./revalidateStream.ts";
import { SessionPolicy } from "./SessionPolicy.ts";
import { withSessionUser } from "./session.ts";

export function permissionLayer<TMiddleware>(
	middleware: Context.Key<TMiddleware, RpcMiddleware.RpcMiddleware<Identity | SessionUser, IdentityFailures, never>> & {
		readonly permission: Permission;
	},
) {
	const permission = middleware.permission;
	return Layer.effect(
		middleware,
		Effect.map(SessionPolicy, (policy) => {
			const guard: RpcMiddleware.RpcMiddleware<Identity | SessionUser, IdentityFailures, never> = (effect, { headers, rpc }) => {
				const lookup = Effect.tap(recheckSession(headers, rpc._tag), (session) =>
					Option.isSome(session) && !hasPermission(session.value.user, permission) ? Effect.fail(forbidden(permission)) : Effect.void,
				);
				return effect.pipe(
					(invocation) => Effect.flatMap(Identity, ({ id }) => invocation.pipe(revalidateStream(rpc, id, lookup))),
					(invocation) =>
						Effect.andThen(
							Effect.flatMap(SessionUser, (user) => requirePermission(user, permission)),
							invocation,
						),
					withSessionUser(headers, rpc._tag),
					Effect.provideService(SessionPolicy, policy),
				);
			};
			return guard;
		}),
	);
}
