import { Effect } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import type { Permission } from "@shivaedev/access/permission.ts";
import { requirePermission } from "@shivaedev/access/requirePermission.ts";
import type { AuthUnavailable, Forbidden, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { type Identity, SessionUser } from "#identity.ts";
import type { SessionPolicy } from "#server/SessionPolicy.ts";
import { withSessionUser } from "#server/session.ts";

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
	return <E, R>(
		handler: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
	): Effect.Effect<
		HttpServerResponse.HttpServerResponse,
		E,
		HttpServerRequest.HttpServerRequest | SessionPolicy | Exclude<R, Identity | SessionUser>
	> =>
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			return yield* Effect.andThen(
				Effect.flatMap(SessionUser, (user) => requirePermission(user, permission)),
				Effect.context<Identity | SessionUser>(),
			).pipe(
				withSessionUser(request.headers, request.url),
				Effect.matchEffect({
					onFailure: (error) => Effect.succeed(rejection(error)),
					onSuccess: (context) => Effect.provideContext(handler, context),
				}),
			);
		});
}
