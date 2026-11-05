import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { Layer } from "effect";
import type { Rpc } from "effect/rpc";
import { appHostHttp } from "#appHostHttp.ts";
import type { HostCoreOptions, HostPolicy, HostRouteRequirements, HostRoutes } from "#hostOptions.ts";
import type { HostPreflight } from "#hostPreflight.ts";
import { hostPreflight } from "#hostPreflight.ts";
import { hostSensitiveKeys } from "#hostSensitiveKeys.ts";

export type AppHttpHostOptions<
	TRpcs extends Rpc.Any = never,
	THandlers = never,
	THandlerError = never,
	THandlerRequirements = never,
	TServices = never,
	TServiceError = never,
	TServiceRequirements = never,
	TPreflight = never,
	TPreflightError = never,
	TPreflightRequirements = never,
	TRouteError = never,
	TRouteRequirements = HostRouteRequirements,
	TRequestServices = never,
	TRequestRequirements = never,
> = HostPreflight<TPreflight, TPreflightError, TPreflightRequirements> &
	HostCoreOptions<
		TRpcs,
		THandlers,
		THandlerError,
		THandlerRequirements,
		TServices,
		TServiceError,
		TServiceRequirements,
		TRequestServices,
		TRequestRequirements
	> &
	HostRoutes<TRouteError, TRouteRequirements> &
	HostPolicy & { readonly migrations?: undefined };
function buildHttpHost<
	TRpcs extends Rpc.Any = never,
	THandlers = never,
	THandlerError = never,
	THandlerRequirements = never,
	TServices = never,
	TServiceError = never,
	TServiceRequirements = never,
	TPreflight = never,
	TPreflightError = never,
	TPreflightRequirements = never,
	TRouteError = never,
	TRouteRequirements = HostRouteRequirements,
	TRequestServices = never,
	TRequestRequirements = never,
>(
	options: AppHttpHostOptions<
		TRpcs,
		THandlers,
		THandlerError,
		THandlerRequirements,
		TServices,
		TServiceError,
		TServiceRequirements,
		TPreflight,
		TPreflightError,
		TPreflightRequirements,
		TRouteError,
		TRouteRequirements,
		TRequestServices,
		TRequestRequirements
	>,
) {
	return appHostHttp(options).pipe(Layer.provideMerge(hostPreflight(options.preflight, hostSensitiveKeys(options))), Layer.provide(NodeCrypto.layer));
}

type HttpHostFactory = <
	TRpcs extends Rpc.Any = never,
	THandlers = never,
	THandlerError = never,
	THandlerRequirements = never,
	TServices = never,
	TServiceError = never,
	TServiceRequirements = never,
	TPreflight = never,
	TPreflightError = never,
	TPreflightRequirements = never,
	TRouteError = never,
	TRouteRequirements = HostRouteRequirements,
	TRequestServices = never,
	TRequestRequirements = never,
>(
	options: AppHttpHostOptions<
		TRpcs,
		THandlers,
		THandlerError,
		THandlerRequirements,
		TServices,
		TServiceError,
		TServiceRequirements,
		TPreflight,
		TPreflightError,
		TPreflightRequirements,
		TRouteError,
		TRouteRequirements,
		TRequestServices,
		TRequestRequirements
	>,
) => ReturnType<
	typeof buildHttpHost<
		TRpcs,
		THandlers,
		THandlerError,
		THandlerRequirements,
		TServices,
		TServiceError,
		TServiceRequirements,
		NoInfer<TPreflight>,
		NoInfer<TPreflightError>,
		NoInfer<TPreflightRequirements>,
		TRouteError,
		TRouteRequirements,
		TRequestServices,
		TRequestRequirements
	>
>;

export const appHost: HttpHostFactory = buildHttpHost;
