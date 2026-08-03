import type {
	TRPCMutationProcedure,
	TRPCProcedureBuilder,
	TRPCQueryProcedure,
	TRPCSubscriptionProcedure,
} from "@trpc/server";
import { Schema } from "effect";
import { makeProcedureHandler } from "./internal/procedure-handler.js";
import type {
	DefaultValue,
	EffectProcedureResolver,
	EffectSubscriptionResolver,
	IntersectIfDefined,
	ResolverContext,
} from "./internal/procedure-types.js";
import type { RuntimeBridge } from "./internal/runtime.js";
import { captureStackTrace } from "./internal/stack-trace.js";
import { makeSubscriptionHandler } from "./internal/subscription-handler.js";
import type { EffectProcedureRequestServices } from "./request-services.js";

type Builder<
	Context,
	Meta,
	ContextOverrides,
	InputIn,
	InputOut,
	OutputIn,
	OutputOut,
> = TRPCProcedureBuilder<
	Context,
	Meta,
	ContextOverrides,
	InputIn,
	InputOut,
	OutputIn,
	OutputOut,
	false
>;

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
		private readonly builder: Builder<
			Context,
			Meta,
			ContextOverrides,
			InputIn,
			InputOut,
			OutputIn,
			OutputOut
		>,
		private readonly requestServices: EffectProcedureRequestServices<
			ResolverContext<
				Builder<
					Context,
					Meta,
					ContextOverrides,
					InputIn,
					InputOut,
					OutputIn,
					OutputOut
				>
			>,
			ProvidedServices,
			LayerError
		>,
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
		const next = this.builder.input(Schema.toStandardSchemaV1(schema) as never);
		const subscriptionNext = this.subscriptionBuilder.input(
			Schema.toStandardSchemaV1(schema) as never,
		);
		return new EffectProcedureBuilder(
			next as unknown as Builder<
				Context,
				Meta,
				ContextOverrides,
				IntersectIfDefined<InputIn, SchemaValue["Encoded"]>,
				IntersectIfDefined<InputOut, SchemaValue["Type"]>,
				OutputIn,
				OutputOut
			>,
			this.requestServices,
			this.runtime,
			subscriptionNext as unknown as Builder<
				Context,
				Meta,
				ContextOverrides,
				IntersectIfDefined<InputIn, SchemaValue["Encoded"]>,
				IntersectIfDefined<InputOut, SchemaValue["Type"]>,
				OutputIn,
				OutputOut
			>,
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
		const next = this.builder.output(Schema.toStandardSchemaV1(schema));
		return new EffectProcedureBuilder(
			next as unknown as Builder<
				Context,
				Meta,
				ContextOverrides,
				InputIn,
				InputOut,
				IntersectIfDefined<OutputIn, SchemaValue["Encoded"]>,
				IntersectIfDefined<OutputOut, SchemaValue["Type"]>
			>,
			this.requestServices,
			this.runtime,
			this.subscriptionBuilder as unknown as Builder<
				Context,
				Meta,
				ContextOverrides,
				InputIn,
				InputOut,
				IntersectIfDefined<OutputIn, SchemaValue["Encoded"]>,
				IntersectIfDefined<OutputOut, SchemaValue["Type"]>
			>,
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
	}> {
		return this.dispatch("query", resolver) as TRPCQueryProcedure<{
			input: DefaultValue<InputIn, void>;
			output: DefaultValue<OutputOut, Output>;
			meta: Meta;
		}>;
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
	}> {
		return this.dispatch("mutation", resolver) as TRPCMutationProcedure<{
			input: DefaultValue<InputIn, void>;
			output: DefaultValue<OutputOut, Output>;
			meta: Meta;
		}>;
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
	}> {
		const handler = makeSubscriptionHandler(
			this.runtime,
			resolver,
			this.requestServices,
			{
				captureStackTrace: captureStackTrace(),
				type: "subscription",
			},
			this.subscriptionOutput,
		) as never;
		return this.subscriptionBuilder.subscription(
			handler,
		) as TRPCSubscriptionProcedure<{
			input: DefaultValue<InputIn, void>;
			output: AsyncIterable<DefaultValue<OutputOut, Output>, void, unknown>;
			meta: Meta;
		}>;
	}

	private dispatch<Output>(
		type: "mutation" | "query",
		resolver: EffectProcedureResolver<
			DefaultValue<InputOut, undefined>,
			ProvidedServices | NoInfer<RuntimeRequirements>,
			Output
		>,
	): unknown {
		const handler = makeProcedureHandler(
			this.runtime,
			resolver,
			this.requestServices,
			{ captureStackTrace: captureStackTrace(), type },
		) as never;
		return type === "query"
			? this.builder.query(handler)
			: this.builder.mutation(handler);
	}
}
