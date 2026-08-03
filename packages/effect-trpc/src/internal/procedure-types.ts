import type {
	inferProcedureBuilderResolverOptions,
	TRPCProcedureBuilder,
	TRPCUnsetMarker,
} from "@trpc/server";
import type { Effect, Stream } from "effect";

export type AnyProcedureBuilder = TRPCProcedureBuilder<
	// biome-ignore lint/suspicious/noExplicitAny: tRPC phantom slot extraction
	any,
	// biome-ignore lint/suspicious/noExplicitAny: tRPC phantom slot extraction
	any,
	// biome-ignore lint/suspicious/noExplicitAny: tRPC phantom slot extraction
	any,
	// biome-ignore lint/suspicious/noExplicitAny: tRPC phantom slot extraction
	any,
	// biome-ignore lint/suspicious/noExplicitAny: tRPC phantom slot extraction
	any,
	// biome-ignore lint/suspicious/noExplicitAny: tRPC phantom slot extraction
	any,
	// biome-ignore lint/suspicious/noExplicitAny: tRPC phantom slot extraction
	any,
	false
>;

export type DefaultValue<Value, Fallback> = Value extends TRPCUnsetMarker
	? Fallback
	: Value;

export type IntersectIfDefined<Value, With> = Value extends TRPCUnsetMarker
	? With
	: With extends TRPCUnsetMarker
		? Value
		: Value & With;

export type ResolverContext<Builder extends AnyProcedureBuilder> =
	inferProcedureBuilderResolverOptions<Builder>["ctx"];

export type ProcedureEffect<Requirements> = Effect.Effect<
	// biome-ignore lint/suspicious/noExplicitAny: success is inferred from each yielded Effect
	any,
	// biome-ignore lint/suspicious/noExplicitAny: errors are inferred from each yielded Effect
	any,
	Requirements
>;

export type EffectProcedureResolver<Input, Requirements, Output> = (
	input: Input,
) => Generator<ProcedureEffect<Requirements>, Output, never>;

export type EffectSubscriptionResolver<Input, Requirements, Output> = (
	input: Input,
) => Generator<
	ProcedureEffect<Requirements>,
	Stream.Stream<Output, unknown, Requirements>,
	never
>;
