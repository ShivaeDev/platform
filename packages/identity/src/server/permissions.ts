import { type Context, Effect, Layer, Option } from "effect";
import { type HttpServerRequest, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import type { RpcMiddleware } from "effect/rpc";
import type { Permission } from "@shivaedev/access/permission.ts";
import { forbidden } from "@shivaedev/access/refusal.ts";
import { requirePermission } from "@shivaedev/access/requirePermission.ts";
import { authorizeReads } from "@shivaedev/contract/readPolicy.ts";
import type { AuthUnavailable, Forbidden, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { Identity, SessionUser } from "#identity.ts";
import type { IdentityFailures } from "#middleware.ts";
import { hasPermission } from "#permission.ts";
import { commandChanges } from "#server/commandChanges.ts";
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
			const guard: RpcMiddleware.RpcMiddleware<Identity | SessionUser, IdentityFailures, never> = (effect, { headers, rpc, payload }) => {
				const lookup = Effect.tap(recheckSession(headers, rpc._tag), (session) =>
					Option.isSome(session) && !hasPermission(session.value.user, permission) ? Effect.fail(forbidden(permission)) : Effect.void,
				);
				return Effect.flatMap(Identity, (viewer) => authorizeReads(commandChanges(effect, rpc, payload), { payload, rpc }, Option.some(viewer))).pipe(
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
function rejection(error: Unauthorized | Forbidden | AuthUnavailable) {
	return HttpServerResponse.empty({
		headers: { "cache-control": "private, no-store" },
		status: {
			AuthUnavailable: HttpStatus.fromLiteral("ServiceUnavailable"),
			Forbidden: HttpStatus.fromLiteral("Forbidden"),
			Unauthorized: HttpStatus.fromLiteral("Unauthorized"),
		}[error._tag],
	});
}

export function permissionRoute(permission: Permission) {
	return <E, R>(handler: (request: HttpServerRequest.HttpServerRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
		(
			request: HttpServerRequest.HttpServerRequest,
		): Effect.Effect<HttpServerResponse.HttpServerResponse, E, SessionPolicy | Exclude<R, Identity | SessionUser>> =>
			Effect.andThen(
				Effect.flatMap(SessionUser, (user) => requirePermission(user, permission)),
				Effect.context<Identity | SessionUser>(),
			).pipe(
				withSessionUser(request.headers, request.url),
				Effect.matchEffect({
					onFailure: (error) => Effect.succeed(rejection(error)),
					onSuccess: (context) => Effect.provideContext(handler(request), context),
				}),
			);
}
