import type { TRPCMutationProcedure, TRPCQueryProcedure, TRPCSubscriptionProcedure } from "@trpc/server";
import { Schema } from "effect";
import { makeProcedureHandler } from "./internal/procedure-handler.ts";
import type {
	DefaultValue,
	EffectProcedureResolver,
	EffectSubscriptionResolver,
	IntersectIfDefined,
	ProcedureBuilderSurface,
	ResolverContext,
} from "./internal/procedure-types.ts";
import type { RuntimeBridge } from "./internal/runtime.ts";
import { captureStackTrace } from "./internal/stack-trace.ts";
import { makeSubscriptionHandler } from "./internal/subscription-handler.ts";
import type { EffectProcedureRequestServices } from "./request-services.ts";

export class EffectProcedureBuilder<
	Context,
	Meta,
	ContextOverrides,
	InputIn,
	InputOut,
	OutputIn,
	OutputOut,
	ProvidedServices,
	LayerError,
	RuntimeRequirements,
> {
	constructor(
		private readonly builder: ProcedureBuilderSurface<ResolverContext<Context, Meta, ContextOverrides>>,
		private readonly requestServices: EffectProcedureRequestServices<ResolverContext<Context, Meta, ContextOverrides>, ProvidedServices, LayerError>,
		private readonly runtime: RuntimeBridge<RuntimeRequirements>,
		private readonly subscriptionBuilder = builder,
		private readonly subscriptionOutput?: Schema.ConstraintDecoder<unknown>,
	) {}

	input<SchemaValue extends Schema.ConstraintDecoder<unknown>>(
		schema: SchemaValue,
	): EffectProcedureBuilder<
		Context,
		Meta,
		ContextOverrides,
		IntersectIfDefined<InputIn, SchemaValue["Encoded"]>,
		IntersectIfDefined<InputOut, SchemaValue["Type"]>,
		OutputIn,
		OutputOut,
		ProvidedServices,
		LayerError,
		RuntimeRequirements
	> {
		const parser = Schema.toStandardSchemaV1(schema);
		return new EffectProcedureBuilder(
			this.builder.input(parser),
			this.requestServices,
			this.runtime,
			this.subscriptionBuilder.input(parser),
			this.subscriptionOutput,
		);
	}

	output<SchemaValue extends Schema.ConstraintDecoder<unknown>>(
		schema: SchemaValue,
	): EffectProcedureBuilder<
		Context,
		Meta,
		ContextOverrides,
		InputIn,
		InputOut,
		IntersectIfDefined<OutputIn, SchemaValue["Encoded"]>,
		IntersectIfDefined<OutputOut, SchemaValue["Type"]>,
		ProvidedServices,
		LayerError,
		RuntimeRequirements
	> {
		return new EffectProcedureBuilder(
			this.builder.output(Schema.toStandardSchemaV1(schema)),
			this.requestServices,
			this.runtime,
			this.subscriptionBuilder,
			schema,
		);
	}

	query<Output>(
		resolver: EffectProcedureResolver<
			DefaultValue<InputOut, undefined>,
			ProvidedServices | NoInfer<RuntimeRequirements>,
			DefaultValue<OutputIn, Output>
		>,
	): TRPCQueryProcedure<{
		input: DefaultValue<InputIn, void>;
		output: DefaultValue<OutputOut, Output>;
		meta: Meta;
	}>;
	query(resolver: EffectProcedureResolver<never, ProvidedServices | RuntimeRequirements, unknown>): unknown {
		return this.builder.query(this.handler("query", resolver));
	}

	mutation<Output>(
		resolver: EffectProcedureResolver<
			DefaultValue<InputOut, undefined>,
			ProvidedServices | NoInfer<RuntimeRequirements>,
			DefaultValue<OutputIn, Output>
		>,
	): TRPCMutationProcedure<{
		input: DefaultValue<InputIn, void>;
		output: DefaultValue<OutputOut, Output>;
		meta: Meta;
	}>;
	mutation(resolver: EffectProcedureResolver<never, ProvidedServices | RuntimeRequirements, unknown>): unknown {
		return this.builder.mutation(this.handler("mutation", resolver));
	}

	subscription<Output>(
		resolver: EffectSubscriptionResolver<
			DefaultValue<InputOut, undefined>,
			ProvidedServices | NoInfer<RuntimeRequirements>,
			DefaultValue<OutputIn, Output>
		>,
	): TRPCSubscriptionProcedure<{
		input: DefaultValue<InputIn, void>;
		output: AsyncIterable<DefaultValue<OutputOut, Output>, void, unknown>;
		meta: Meta;
	}>;
	subscription(resolver: EffectSubscriptionResolver<never, ProvidedServices | RuntimeRequirements, unknown>): unknown {
		return this.subscriptionBuilder.subscription(
			makeSubscriptionHandler(
				this.runtime,
				resolver,
				this.requestServices,
				{ captureStackTrace: captureStackTrace(), type: "subscription" },
				this.subscriptionOutput,
			),
		);
	}

	private handler(type: "mutation" | "query", resolver: EffectProcedureResolver<never, ProvidedServices | RuntimeRequirements, unknown>) {
		return makeProcedureHandler(this.runtime, resolver, this.requestServices, { captureStackTrace: captureStackTrace(), type });
	}
}
