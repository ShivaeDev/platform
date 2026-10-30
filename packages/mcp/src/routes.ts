import { Effect, type Layer } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import type { Permission } from "@shivaedev/access/permission.ts";
import type { AuthUnavailable, Forbidden, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import type { Identity, SessionUser } from "@shivaedev/identity/identity.ts";
import { type SessionPolicy, type UserSessionShape, withSessionUser } from "@shivaedev/identity/server/session.ts";
import { requestServer } from "./requestServer.ts";

export interface Audience<E = never, R = never> {
	readonly permission?: Permission;
	readonly tools: Layer.Layer<never, E, R>;
}

export interface McpOptions<TSession extends UserSessionShape, E, R> {
	readonly allowedOrigins?: readonly string[];
	readonly audiences: readonly Audience<E, R>[];
	readonly name: string;
	readonly path: HttpRouter.PathInput;
	readonly resourceMetadataUrl: string;
	readonly sessions: SessionPolicy<TSession>;
	readonly version: string;
}

function rejection(error: AuthUnavailable | Forbidden | Unauthorized, metadataUrl: string) {
	return HttpServerResponse.empty({
		headers: error._tag === "Unauthorized" ? { "cache-control": "no-store", "www-authenticate": `Bearer resource_metadata="${metadataUrl}"` } : {},
		status: {
			AuthUnavailable: HttpStatus.fromLiteral("ServiceUnavailable"),
			Forbidden: HttpStatus.fromLiteral("Forbidden"),
			Unauthorized: HttpStatus.fromLiteral("Unauthorized"),
		}[error._tag],
	});
}

export function mcpRoutes<TSession extends UserSessionShape, E, R>(options: McpOptions<TSession, E, R>) {
	const server = requestServer(options);
	return HttpRouter.use((router) =>
		router.add("*", options.path, (request) =>
			Effect.context<Identity | SessionUser>().pipe(
				withSessionUser(options.sessions, request.headers, request.url),
				Effect.matchEffect({
					onFailure: (error) => Effect.succeed(rejection(error, options.resourceMetadataUrl)),
					onSuccess: (context) => Effect.provideContext(server, context),
				}),
			),
		),
	);
}
