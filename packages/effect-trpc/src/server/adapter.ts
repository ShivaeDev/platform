import type { TRPCProcedureBuilder } from "@trpc/server";
import type { Context, Effect, Exit } from "effect";
import { makeContextBridge } from "#server/internal/contextBridge.ts";
import { looseBuilder } from "#server/internal/loose.ts";
import type { ResolverContext } from "#server/internal/procedureTypes.ts";
import { makeRuntimeBridge } from "#server/internal/runtime.ts";
import { EffectProcedureBuilder } from "./EffectProcedureBuilder.ts";
import type { EffectProcedureRequestServices } from "./requestServices.ts";
import type { EffectTRPCErrorMapper, EffectTRPCInstrument, EffectTRPCStreamInstrument } from "./types.ts";

export interface MakeEffectTRPCOptions<TRequirements, TRuntimeError> {
	readonly instrument?: EffectTRPCInstrument;
	readonly instrumentStream?: EffectTRPCStreamInstrument;
	readonly mapError?: EffectTRPCErrorMapper;
	readonly runtime: EffectTRPCRuntime<TRequirements, TRuntimeError>;
}
export interface EffectTRPCRuntime<TRequirements, TRuntimeError> {
	readonly contextEffect: Effect.Effect<Context.Context<TRequirements>, TRuntimeError>;
	readonly currentServices?: () => Context.Context<never> | undefined;
	readonly runPromise: <TValue, TError>(
		effect: Effect.Effect<TValue, TError, TRequirements>,
		options?: {
			readonly signal?: AbortSignal;
		},
	) => Promise<TValue>;
	readonly runPromiseExit: <TValue, TError>(
		effect: Effect.Effect<TValue, TError, TRequirements>,
		options?: {
			readonly signal?: AbortSignal;
		},
	) => Promise<Exit.Exit<TValue, TError | TRuntimeError>>;
	readonly runWithServices?: <TServices, TValue>(services: Context.Context<TServices>, evaluate: () => TValue) => TValue;
}
export interface EffectTRPCAdapter<TRequirements> {
	readonly procedure: <TContext, TMeta, TContextOverrides, TInputIn, TInputOut, TOutputIn, TOutputOut, TProvidedServices, TLayerError>(
		builder: TRPCProcedureBuilder<TContext, TMeta, TContextOverrides, TInputIn, TInputOut, TOutputIn, TOutputOut, false>,
		requestServices: EffectProcedureRequestServices<ResolverContext<TContext, TMeta, TContextOverrides>, TProvidedServices, TLayerError>,
	) => EffectProcedureBuilder<
		TContext,
		TMeta,
		TContextOverrides,
		TInputIn,
		TInputOut,
		TOutputIn,
		TOutputOut,
		TProvidedServices,
		TLayerError,
		TRequirements
	>;
	readonly runWithServices: <TServices, TValue>(services: Context.Context<TServices>, evaluate: () => TValue) => TValue;
}
export function makeEffectTRPC<TRequirements, TRuntimeError = never>(
	options: MakeEffectTRPCOptions<TRequirements, TRuntimeError>,
): EffectTRPCAdapter<TRequirements> {
	const contextBridge = makeContextBridge(options.runtime);
	const runtime = makeRuntimeBridge(options.runtime, contextBridge, options);
	return {
		procedure: <TContext, TMeta, TContextOverrides, TInputIn, TInputOut, TOutputIn, TOutputOut, TProvidedServices, TLayerError>(
			builder: TRPCProcedureBuilder<TContext, TMeta, TContextOverrides, TInputIn, TInputOut, TOutputIn, TOutputOut, false>,
			requestServices: EffectProcedureRequestServices<ResolverContext<TContext, TMeta, TContextOverrides>, TProvidedServices, TLayerError>,
		) => {
			const loose = looseBuilder(builder);
			return new EffectProcedureBuilder<
				TContext,
				TMeta,
				TContextOverrides,
				TInputIn,
				TInputOut,
				TOutputIn,
				TOutputOut,
				TProvidedServices,
				TLayerError,
				TRequirements
			>({
				builder: loose,
				requestServices,
				runtime,
				subscriptionBuilder: loose,
			});
		},
		runWithServices: contextBridge.run,
	};
}
