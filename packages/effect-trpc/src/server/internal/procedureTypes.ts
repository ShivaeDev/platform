import type { inferProcedureBuilderResolverOptions, TRPCProcedureBuilder, TRPCUnsetMarker } from "@trpc/server";
import type { Effect, StandardSchema, Stream } from "effect";
export type ProcedureBuilderOf<TContext, TMeta, TContextOverrides, TInputIn, TInputOut, TOutputIn, TOutputOut> = TRPCProcedureBuilder<
	TContext,
	TMeta,
	TContextOverrides,
	TInputIn,
	TInputOut,
	TOutputIn,
	TOutputOut,
	false
>;
export type DefaultValue<TValue, TFallback> = TValue extends TRPCUnsetMarker ? TFallback : TValue;
export type IntersectIfDefined<TValue, TWith> = TValue extends TRPCUnsetMarker ? TWith : TWith extends TRPCUnsetMarker ? TValue : TValue & TWith;
export type ResolverContext<TContext, TMeta, TContextOverrides> = inferProcedureBuilderResolverOptions<
	ProcedureBuilderOf<TContext, TMeta, TContextOverrides, TRPCUnsetMarker, TRPCUnsetMarker, TRPCUnsetMarker, TRPCUnsetMarker>
>["ctx"];
export type ProcedureEffect<TRequirements> = Effect.Effect<unknown, unknown, TRequirements>;
export type EffectProcedureResolver<TInput, TRequirements, TOutput> = (input: TInput) => Generator<ProcedureEffect<TRequirements>, TOutput, never>;
export type EffectSubscriptionResolver<TInput, TRequirements, TOutput> = (
	input: TInput,
) => Generator<ProcedureEffect<TRequirements>, Stream.Stream<TOutput, unknown, TRequirements>, never>;
export interface ProcedureInvocation<TContext> {
	readonly ctx: TContext;
	readonly input: unknown;
	readonly path: string;
	readonly signal: AbortSignal | undefined;
}
export interface ProcedureBuilderSurface<TContext> {
	input: (schema: StandardSchema.StandardSchemaV1) => ProcedureBuilderSurface<TContext>;
	mutation: (resolver: (invocation: ProcedureInvocation<TContext>) => Promise<unknown>) => unknown;
	output: (schema: StandardSchema.StandardSchemaV1) => ProcedureBuilderSurface<TContext>;
	query: (resolver: (invocation: ProcedureInvocation<TContext>) => Promise<unknown>) => unknown;
	subscription: (resolver: (invocation: ProcedureInvocation<TContext>) => Promise<AsyncIterable<unknown, void, unknown>>) => unknown;
}
