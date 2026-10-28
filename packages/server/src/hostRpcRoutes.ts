import { ByteSize, Effect, Layer } from "effect";
import { HttpEffect, HttpIncomingMessage, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { type Rpc, type RpcGroup, RpcSerialization } from "effect/rpc";
import type { Authenticated, MaybeAuthenticated, RequestTracing } from "@shivaedev/identity/middleware.ts";
import { localRpcGuard } from "@shivaedev/identity/server/local.ts";
import { authenticatedLayer, maybeAuthenticatedLayer, type SessionShape } from "@shivaedev/identity/server/session.ts";
import { requestTracingLayer } from "@shivaedev/identity/server/tracing.ts";
import type { AppChanges } from "#appHost.ts";
import { boundedRpcRequest } from "#boundedRpcRequest.ts";
import { hostChanges } from "#hostChanges.ts";
import type { HostPolicy } from "#hostOptions.ts";
import { hostRpc, rpcCacheControl } from "#hostRpc.ts";
import type { hostTransport } from "#hostTransport.ts";
import { redactingRpcSerialization } from "#redactingRpcSerialization.ts";
import type { schemaSensitiveKeys } from "#schemaSensitiveKeys.ts";

export function hostRpcRoutes<TRpcs extends Rpc.Any, THandlers, TError, TRequirements, TSession extends SessionShape>(
	options: {
		readonly group: RpcGroup.RpcGroup<TRpcs>;
		readonly handlers: Layer.Layer<THandlers, TError, TRequirements>;
		readonly rpcPath?: HttpRouter.PathInput;
	} & HostPolicy<TSession>,
	changesService: typeof AppChanges,
	{ bodySize, trustedProxy, nativeOrigins }: Effect.Success<ReturnType<typeof hostTransport>>,
	sensitive: ReturnType<typeof schemaSensitiveKeys>,
) {
	const middleware: Layer.Layer<RequestTracing> | Layer.Layer<Authenticated | MaybeAuthenticated | RequestTracing> =
		options.policy === "loopback"
			? requestTracingLayer({ sensitive })
			: Layer.mergeAll(authenticatedLayer(options.sessions), maybeAuthenticatedLayer(options.sessions), requestTracingLayer({ sensitive }));
	return HttpRouter.use((router) =>
		Effect.gen(function* () {
			const wire = redactingRpcSerialization(yield* RpcSerialization.RpcSerialization, sensitive, sensitive.maskFailure);
			const handler = yield* hostRpc(options.group).pipe(Effect.provideService(RpcSerialization.RpcSerialization, wire));
			const guarded = localRpcGuard(handler, trustedProxy, nativeOrigins);
			yield* router.add(
				"OPTIONS",
				options.rpcPath ?? "/rpc",
				HttpServerResponse.text("Local same-origin requests only", {
					status: HttpStatus.fromLiteral("Forbidden"),
				}),
			);
			yield* router.add("POST", options.rpcPath ?? "/rpc", (request) => {
				HttpEffect.appendPreResponseHandlerUnsafe(request, rpcCacheControl);
				return guarded.pipe(
					Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.bytes(bodySize)),
					Effect.provideService(HttpServerRequest.HttpServerRequest, boundedRpcRequest(request)),
					Effect.provideService(RpcSerialization.RpcSerialization, wire),
				);
			});
		}),
	).pipe(
		Layer.provide(Layer.merge(middleware, hostChanges(options.group, changesService).pipe(Layer.provideMerge(options.handlers)))),
		Layer.provide(RpcSerialization.layerNdjson),
	);
}
