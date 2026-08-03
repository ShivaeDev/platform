import type {
	inferProcedureBuilderResolverOptions,
	TRPCProcedureBuilder,
} from "@trpc/server";
import type { Context, ManagedRuntime } from "effect";
import { makeContextBridge } from "./internal/context-bridge.js";
import { makeRuntimeBridge } from "./internal/runtime.js";
import { EffectProcedureBuilder } from "./procedure.js";
import type { EffectProcedureRequestServices } from "./request-services.js";
import type { EffectTRPCErrorMapper, EffectTRPCInstrument } from "./types.js";

export interface MakeEffectTRPCOptions<Requirements, RuntimeError> {
	readonly instrument?: EffectTRPCInstrument;
	readonly mapError?: EffectTRPCErrorMapper;
	readonly runtime: ManagedRuntime.ManagedRuntime<Requirements, RuntimeError>;
}

export interface EffectTRPCAdapter<Requirements> {
	readonly procedure: <
		Context,
		Meta,
		ContextOverrides,
		InputIn,
		InputOut,
		OutputIn,
		OutputOut,
		ProvidedServices,
		LayerError,
	>(
		builder: TRPCProcedureBuilder<
			Context,
			Meta,
			ContextOverrides,
			InputIn,
			InputOut,
			OutputIn,
			OutputOut,
			false
		>,
		requestServices: EffectProcedureRequestServices<
			inferProcedureBuilderResolverOptions<
				TRPCProcedureBuilder<
					Context,
					Meta,
					ContextOverrides,
					InputIn,
					InputOut,
					OutputIn,
					OutputOut,
					false
				>
			>["ctx"],
			ProvidedServices,
			LayerError
		>,
	) => EffectProcedureBuilder<
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
	>;
	readonly runWithServices: <Services, Value>(
		services: Context.Context<Services>,
		evaluate: () => Value,
	) => Value;
}

export const makeEffectTRPC = <Requirements, RuntimeError = never>(
	options: MakeEffectTRPCOptions<Requirements, RuntimeError>,
): EffectTRPCAdapter<Requirements> => {
	const contextBridge = makeContextBridge();
	const runtime = makeRuntimeBridge(options.runtime, contextBridge, options);

	return {
		procedure: (builder, requestServices) =>
			new EffectProcedureBuilder(builder, requestServices, runtime) as never,
		runWithServices: contextBridge.run,
	};
};
