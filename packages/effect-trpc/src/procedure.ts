import type {
	TRPCMutationProcedure,
	TRPCProcedureBuilder,
	TRPCQueryProcedure,
} from "@trpc/server";
import { Schema } from "effect";
import { makeProcedureHandler } from "./internal/procedure-handler.js";
import type {
	DefaultValue,
	EffectProcedureResolver,
	IntersectIfDefined,
	ResolverContext,
} from "./internal/procedure-types.js";
import type { RuntimeBridge } from "./internal/runtime.js";
import { captureStackTrace } from "./internal/stack-trace.js";
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
