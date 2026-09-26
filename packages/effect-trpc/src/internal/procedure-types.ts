import type { inferProcedureBuilderResolverOptions, TRPCProcedureBuilder, TRPCUnsetMarker } from "@trpc/server";
import type { Effect, StandardSchema, Stream } from "effect";

export type ProcedureBuilderOf<Context, Meta, ContextOverrides, InputIn, InputOut, OutputIn, OutputOut> = TRPCProcedureBuilder<
	Context,
	Meta,
	ContextOverrides,
	InputIn,
	InputOut,
	OutputIn,
	OutputOut,
	false
>;

export type DefaultValue<Value, Fallback> = Value extends TRPCUnsetMarker ? Fallback : Value;

export type IntersectIfDefined<Value, With> = Value extends TRPCUnsetMarker ? With : With extends TRPCUnsetMarker ? Value : Value & With;

export type ResolverContext<Context, Meta, ContextOverrides> = inferProcedureBuilderResolverOptions<
	ProcedureBuilderOf<Context, Meta, ContextOverrides, TRPCUnsetMarker, TRPCUnsetMarker, TRPCUnsetMarker, TRPCUnsetMarker>
>["ctx"];

export type ProcedureEffect<Requirements> = Effect.Effect<unknown, unknown, Requirements>;

export type EffectProcedureResolver<Input, Requirements, Output> = (input: Input) => Generator<ProcedureEffect<Requirements>, Output, never>;

export type EffectSubscriptionResolver<Input, Requirements, Output> = (
	input: Input,
) => Generator<ProcedureEffect<Requirements>, Stream.Stream<Output, unknown, Requirements>, never>;

export interface ProcedureInvocation<Context> {
	readonly ctx: Context;
	readonly input: unknown;
	readonly path: string;
	readonly signal: AbortSignal | undefined;
}

export interface ProcedureBuilderSurface<Context> {
	input(schema: StandardSchema.StandardSchemaV1): ProcedureBuilderSurface<Context>;
	output(schema: StandardSchema.StandardSchemaV1): ProcedureBuilderSurface<Context>;
	query(resolver: (invocation: ProcedureInvocation<Context>) => Promise<unknown>): unknown;
	mutation(resolver: (invocation: ProcedureInvocation<Context>) => Promise<unknown>): unknown;
	subscription(resolver: (invocation: ProcedureInvocation<Context>) => Promise<AsyncIterable<unknown, void, unknown>>): unknown;
}
