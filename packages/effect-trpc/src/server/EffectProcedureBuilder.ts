import type { TRPCMutationProcedure, TRPCQueryProcedure, TRPCSubscriptionProcedure } from "@trpc/server";
import { Schema } from "effect";
import { makeProcedureHandler } from "#internal/procedure-handler.ts";
import type {
	DefaultValue,
	EffectProcedureResolver,
	EffectSubscriptionResolver,
	IntersectIfDefined,
	ProcedureBuilderSurface,
	ResolverContext,
} from "#internal/procedure-types.ts";
import type { RuntimeBridge } from "#internal/runtime.ts";
import { captureStackTrace } from "#internal/stack-trace.ts";
import { makeSubscriptionHandler } from "#internal/subscription-handler.ts";
import type { EffectProcedureRequestServices } from "./requestServices.ts";

interface ProcedureParts<TContext, TMeta, TContextOverrides, TProvidedServices, TLayerError, TRuntimeRequirements> {
	readonly builder: ProcedureBuilderSurface<ResolverContext<TContext, TMeta, TContextOverrides>>;
	readonly requestServices: EffectProcedureRequestServices<ResolverContext<TContext, TMeta, TContextOverrides>, TProvidedServices, TLayerError>;
	readonly runtime: RuntimeBridge<TRuntimeRequirements>;
	readonly subscriptionBuilder: ProcedureBuilderSurface<ResolverContext<TContext, TMeta, TContextOverrides>>;
	readonly subscriptionOutput?: Schema.ConstraintDecoder<unknown> | undefined;
}
export class EffectProcedureBuilder<
	TContext,
	TMeta,
	TContextOverrides,
	TInputIn,
	TInputOut,
	TOutputIn,
	TOutputOut,
	TProvidedServices,
	TLayerError,
	TRuntimeRequirements,
> {
	readonly #parts: ProcedureParts<TContext, TMeta, TContextOverrides, TProvidedServices, TLayerError, TRuntimeRequirements>;
	constructor(parts: ProcedureParts<TContext, TMeta, TContextOverrides, TProvidedServices, TLayerError, TRuntimeRequirements>) {
		this.#parts = parts;
	}
	input<TSchemaValue extends Schema.ConstraintDecoder<unknown>>(
		schema: TSchemaValue,
	): EffectProcedureBuilder<
		TContext,
		TMeta,
		TContextOverrides,
		IntersectIfDefined<TInputIn, TSchemaValue["Encoded"]>,
		IntersectIfDefined<TInputOut, TSchemaValue["Type"]>,
		TOutputIn,
		TOutputOut,
		TProvidedServices,
		TLayerError,
		TRuntimeRequirements
	> {
		const parser = Schema.toStandardSchemaV1(schema);
		return new EffectProcedureBuilder({
			...this.#parts,
			builder: this.#parts.builder.input(parser),
			subscriptionBuilder: this.#parts.subscriptionBuilder.input(parser),
		});
	}
	output<TSchemaValue extends Schema.ConstraintDecoder<unknown>>(
		schema: TSchemaValue,
	): EffectProcedureBuilder<
		TContext,
		TMeta,
		TContextOverrides,
		TInputIn,
		TInputOut,
		IntersectIfDefined<TOutputIn, TSchemaValue["Encoded"]>,
		IntersectIfDefined<TOutputOut, TSchemaValue["Type"]>,
		TProvidedServices,
		TLayerError,
		TRuntimeRequirements
	> {
		return new EffectProcedureBuilder({
			...this.#parts,
			builder: this.#parts.builder.output(Schema.toStandardSchemaV1(schema)),
			subscriptionOutput: schema,
		});
	}
	query<TOutput>(
		resolver: EffectProcedureResolver<
			DefaultValue<TInputOut, undefined>,
			TProvidedServices | NoInfer<TRuntimeRequirements>,
			DefaultValue<TOutputIn, TOutput>
		>,
	): TRPCQueryProcedure<{
		input: DefaultValue<TInputIn, void>;
		output: DefaultValue<TOutputOut, TOutput>;
		meta: TMeta;
	}>;
	query(resolver: EffectProcedureResolver<never, TProvidedServices | TRuntimeRequirements, unknown>): unknown {
		return this.#parts.builder.query(this.#handler("query", resolver));
	}
	mutation<TOutput>(
		resolver: EffectProcedureResolver<
			DefaultValue<TInputOut, undefined>,
			TProvidedServices | NoInfer<TRuntimeRequirements>,
			DefaultValue<TOutputIn, TOutput>
		>,
	): TRPCMutationProcedure<{
		input: DefaultValue<TInputIn, void>;
		output: DefaultValue<TOutputOut, TOutput>;
		meta: TMeta;
	}>;
	mutation(resolver: EffectProcedureResolver<never, TProvidedServices | TRuntimeRequirements, unknown>): unknown {
		return this.#parts.builder.mutation(this.#handler("mutation", resolver));
	}
	subscription<TOutput>(
		resolver: EffectSubscriptionResolver<
			DefaultValue<TInputOut, undefined>,
			TProvidedServices | NoInfer<TRuntimeRequirements>,
			DefaultValue<TOutputIn, TOutput>
		>,
	): TRPCSubscriptionProcedure<{
		input: DefaultValue<TInputIn, void>;
		output: AsyncIterable<DefaultValue<TOutputOut, TOutput>, void, unknown>;
		meta: TMeta;
	}>;
	subscription(resolver: EffectSubscriptionResolver<never, TProvidedServices | TRuntimeRequirements, unknown>): unknown {
		return this.#parts.subscriptionBuilder.subscription(
			makeSubscriptionHandler(
				this.#parts.runtime,
				resolver,
				this.#parts.requestServices,
				{ captureStackTrace: captureStackTrace(), type: "subscription" },
				this.#parts.subscriptionOutput,
			),
		);
	}
	#handler(type: "mutation" | "query", resolver: EffectProcedureResolver<never, TProvidedServices | TRuntimeRequirements, unknown>) {
		return makeProcedureHandler(this.#parts.runtime, resolver, this.#parts.requestServices, { captureStackTrace: captureStackTrace(), type });
	}
}
