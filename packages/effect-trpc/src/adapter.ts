import type { TRPCProcedureBuilder } from "@trpc/server";
import type { Context, Effect, Exit } from "effect";
import { makeContextBridge } from "./internal/context-bridge.ts";
import { looseBuilder } from "./internal/loose.ts";
import type { ResolverContext } from "./internal/procedure-types.ts";
import { makeRuntimeBridge } from "./internal/runtime.ts";
import { EffectProcedureBuilder } from "./procedure.ts";
import type { EffectProcedureRequestServices } from "./request-services.ts";
import type { EffectTRPCErrorMapper, EffectTRPCInstrument, EffectTRPCStreamInstrument } from "./types.ts";

export interface MakeEffectTRPCOptions<Requirements, RuntimeError> {
	readonly instrument?: EffectTRPCInstrument;
	readonly instrumentStream?: EffectTRPCStreamInstrument;
	readonly mapError?: EffectTRPCErrorMapper;
	readonly runtime: EffectTRPCRuntime<Requirements, RuntimeError>;
}

export interface EffectTRPCRuntime<Requirements, RuntimeError> {
	readonly contextEffect: Effect.Effect<Context.Context<Requirements>, RuntimeError>;
	readonly currentServices?: () => Context.Context<never> | undefined;
	readonly runPromise: <Value, Error>(
		effect: Effect.Effect<Value, Error, Requirements>,
		options?: { readonly signal?: AbortSignal },
	) => Promise<Value>;
	readonly runPromiseExit: <Value, Error>(
		effect: Effect.Effect<Value, Error, Requirements>,
		options?: { readonly signal?: AbortSignal },
	) => Promise<Exit.Exit<Value, Error | RuntimeError>>;
	readonly runWithServices?: <Services, Value>(services: Context.Context<Services>, evaluate: () => Value) => Value;
}

export interface EffectTRPCAdapter<Requirements> {
	readonly procedure: <Context, Meta, ContextOverrides, InputIn, InputOut, OutputIn, OutputOut, ProvidedServices, LayerError>(
		builder: TRPCProcedureBuilder<Context, Meta, ContextOverrides, InputIn, InputOut, OutputIn, OutputOut, false>,
		requestServices: EffectProcedureRequestServices<ResolverContext<Context, Meta, ContextOverrides>, ProvidedServices, LayerError>,
	) => EffectProcedureBuilder<Context, Meta, ContextOverrides, InputIn, InputOut, OutputIn, OutputOut, ProvidedServices, LayerError, Requirements>;
	readonly runWithServices: <Services, Value>(services: Context.Context<Services>, evaluate: () => Value) => Value;
}

export const makeEffectTRPC = <Requirements, RuntimeError = never>(
	options: MakeEffectTRPCOptions<Requirements, RuntimeError>,
): EffectTRPCAdapter<Requirements> => {
	const contextBridge = makeContextBridge(options.runtime);
	const runtime = makeRuntimeBridge(options.runtime, contextBridge, options);

	return {
		procedure: <Context, Meta, ContextOverrides, InputIn, InputOut, OutputIn, OutputOut, ProvidedServices, LayerError>(
			builder: TRPCProcedureBuilder<Context, Meta, ContextOverrides, InputIn, InputOut, OutputIn, OutputOut, false>,
			requestServices: EffectProcedureRequestServices<ResolverContext<Context, Meta, ContextOverrides>, ProvidedServices, LayerError>,
		) => {
			const loose = looseBuilder(builder);
			return new EffectProcedureBuilder<
				Context,
				Meta,
				ContextOverrides,
				InputIn,
				InputOut,
				OutputIn,
				OutputOut,
				ProvidedServices,
				LayerError,
				Requirements
			>({
				builder: loose,
				requestServices,
				runtime,
				subscriptionBuilder: loose,
			});
		},
		runWithServices: contextBridge.run,
	};
};
