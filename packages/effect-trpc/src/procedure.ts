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

interface ProcedureParts<Context, Meta, ContextOverrides, ProvidedServices, LayerError, RuntimeRequirements> {
	readonly builder: ProcedureBuilderSurface<ResolverContext<Context, Meta, ContextOverrides>>;
	readonly requestServices: EffectProcedureRequestServices<ResolverContext<Context, Meta, ContextOverrides>, ProvidedServices, LayerError>;
	readonly runtime: RuntimeBridge<RuntimeRequirements>;
	readonly subscriptionBuilder: ProcedureBuilderSurface<ResolverContext<Context, Meta, ContextOverrides>>;
	readonly subscriptionOutput?: Schema.ConstraintDecoder<unknown> | undefined;
}

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
	private readonly parts: ProcedureParts<Context, Meta, ContextOverrides, ProvidedServices, LayerError, RuntimeRequirements>;

	constructor(parts: ProcedureParts<Context, Meta, ContextOverrides, ProvidedServices, LayerError, RuntimeRequirements>) {
		this.parts = parts;
	}

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
		return new EffectProcedureBuilder({
			...this.parts,
			builder: this.parts.builder.input(parser),
			subscriptionBuilder: this.parts.subscriptionBuilder.input(parser),
		});
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
		return new EffectProcedureBuilder({
			...this.parts,
			builder: this.parts.builder.output(Schema.toStandardSchemaV1(schema)),
			subscriptionOutput: schema,
		});
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
		return this.parts.builder.query(this.handler("query", resolver));
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
		return this.parts.builder.mutation(this.handler("mutation", resolver));
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
		return this.parts.subscriptionBuilder.subscription(
			makeSubscriptionHandler(
				this.parts.runtime,
				resolver,
				this.parts.requestServices,
				{ captureStackTrace: captureStackTrace(), type: "subscription" },
				this.parts.subscriptionOutput,
			),
		);
	}

	private handler(type: "mutation" | "query", resolver: EffectProcedureResolver<never, ProvidedServices | RuntimeRequirements, unknown>) {
		return makeProcedureHandler(this.parts.runtime, resolver, this.parts.requestServices, { captureStackTrace: captureStackTrace(), type });
	}
}
