import { ByteSize, Effect, Layer } from "effect";
import { HttpEffect, HttpIncomingMessage, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { type Rpc, type RpcGroup, RpcSerialization } from "effect/rpc";
import { validateReadPolicies } from "@shivaedev/contract/validateReadPolicies.ts";
import type { schemaSensitiveKeys } from "@shivaedev/errors/schemaSensitiveKeys.ts";
import { localRpcGuard } from "@shivaedev/identity/server/adapters/local.ts";
import type { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { authenticatedLayer, maybeAuthenticatedLayer } from "@shivaedev/identity/server/session.ts";
import { subjectResolverLayer } from "@shivaedev/identity/server/subjectResolverLayer.ts";
import { boundedRpcRequest } from "#boundedRpcRequest.ts";
import { boundedRpcSocket } from "#boundedRpcSocket.ts";
import { hostChanges } from "#hostChanges.ts";
import type { HostPolicy } from "#hostOptions.ts";
import { hostRpc, rpcCacheControl } from "#hostRpc.ts";
import type { hostTransport } from "#hostTransport.ts";
import { redactingRpcSerialization } from "#redactingRpcSerialization.ts";
import { rpcRequestTracing } from "#rpcRequestTracing.ts";
import { socketRpc } from "#socketRpc.ts";
import { UnixSocketRequest } from "#UnixSocketRequest.ts";

type BuiltRoutes<TRpcs extends Rpc.Any, THandlers, TError, TRequirements> = ReturnType<
	typeof buildRpcRoutes<TRpcs, THandlers, TError, TRequirements>
>;
type RouteOptions<TRpcs extends Rpc.Any, THandlers, TError, TRequirements> = {
	readonly group: RpcGroup.RpcGroup<TRpcs>;
	readonly handlers: Layer.Layer<THandlers, TError, TRequirements>;
	readonly rpcPath?: HttpRouter.PathInput;
} & HostPolicy;

export function hostRpcRoutes<TRpcs extends Rpc.Any, THandlers, TError, TRequirements>(
	options: RouteOptions<TRpcs, THandlers, TError, TRequirements> & { readonly policy: "loopback" },
	transport: Effect.Success<ReturnType<typeof hostTransport>>,
	sensitive: Effect.Success<ReturnType<typeof schemaSensitiveKeys>>,
): Layer.Layer<
	Layer.Success<BuiltRoutes<TRpcs, THandlers, TError, TRequirements>>,
	Layer.Error<BuiltRoutes<TRpcs, THandlers, TError, TRequirements>>,
	| TRequirements
	| Exclude<Rpc.ServicesServer<TRpcs>, THandlers>
	| Exclude<Layer.Services<BuiltRoutes<TRpcs, THandlers, TError, TRequirements>>, SessionPolicy | HttpRouter.Request<"Requires", SessionPolicy>>
>;
export function hostRpcRoutes<TRpcs extends Rpc.Any, THandlers, TError, TRequirements>(
	...args: Parameters<typeof buildRpcRoutes<TRpcs, THandlers, TError, TRequirements>>
): BuiltRoutes<TRpcs, THandlers, TError, TRequirements>;
export function hostRpcRoutes<TRpcs extends Rpc.Any, THandlers, TError, TRequirements>(
	...args: Parameters<typeof buildRpcRoutes<TRpcs, THandlers, TError, TRequirements>>
) {
	return buildRpcRoutes(...args);
}

function buildRpcRoutes<TRpcs extends Rpc.Any, THandlers, TError, TRequirements>(
	options: RouteOptions<TRpcs, THandlers, TError, TRequirements>,
	{ bodySize, trustedProxy, nativeOrigins }: Effect.Success<ReturnType<typeof hostTransport>>,
	sensitive: Effect.Success<ReturnType<typeof schemaSensitiveKeys>>,
) {
	const middleware = Layer.merge(
		subjectResolverLayer(),
		options.policy === "loopback"
			? rpcRequestTracing(sensitive)
			: Layer.mergeAll(authenticatedLayer(), maybeAuthenticatedLayer(), rpcRequestTracing(sensitive)),
	);
	return HttpRouter.use((router) =>
		Effect.gen(function* () {
			yield* validateReadPolicies(options.group);
			const wire = redactingRpcSerialization(yield* RpcSerialization.RpcSerialization, sensitive);
			const handler = yield* hostRpc(options.group).pipe(Effect.provideService(RpcSerialization.RpcSerialization, wire));
			const guarded = Effect.flatMap(UnixSocketRequest, (unix) => (unix ? handler : localRpcGuard(handler, trustedProxy, nativeOrigins)));
			const websocket = yield* hostRpc(options.group, true).pipe(Effect.provideService(RpcSerialization.RpcSerialization, wire));
			yield* router.add(
				"OPTIONS",
				options.rpcPath ?? "/rpc",
				HttpServerResponse.text("Local same-origin requests only", {
					status: HttpStatus.fromLiteral("Forbidden"),
				}),
			);
			yield* router.add("GET", options.rpcPath ?? "/rpc", () =>
				boundedRpcSocket(bodySize).pipe(
					Effect.flatMap((request) =>
						socketRpc(websocket, options, trustedProxy, nativeOrigins).pipe(
							Effect.provideService(HttpServerRequest.HttpServerRequest, request),
							Effect.provideService(RpcSerialization.RpcSerialization, wire),
						),
					),
				),
			);
			yield* router.add("POST", options.rpcPath ?? "/rpc", () =>
				boundedRpcRequest().pipe(
					Effect.flatMap((request) =>
						guarded.pipe(
							Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.bytes(bodySize)),
							Effect.provideService(HttpServerRequest.HttpServerRequest, request),
							Effect.provideService(RpcSerialization.RpcSerialization, wire),
							HttpEffect.withPreResponseHandler(rpcCacheControl),
						),
					),
				),
			);
		}),
	).pipe(
		Layer.provide(Layer.merge(middleware, hostChanges(options.group).pipe(Layer.provideMerge(options.handlers)))),
		Layer.provide(RpcSerialization.layerNdjson),
	);
}
