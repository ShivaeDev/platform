import { type Layer as EffectLayer, Layer } from "effect";

export interface EffectProcedureRequestServices<Context, Requirements, TError = never> {
	readonly layer: (context: Context) => EffectLayer.Layer<Requirements, TError>;
}

export const makeRequestServices = <Context, Requirements, TError = never>(
	layer: (context: Context) => EffectLayer.Layer<Requirements, TError>,
): EffectProcedureRequestServices<Context, Requirements, TError> => ({ layer });

export const extendRequestServices = <
	BaseContext,
	Context extends BaseContext,
	BaseRequirements,
	BaseError,
	AdditionalRequirements,
	AdditionalError,
	AdditionalDependencies extends BaseRequirements = BaseRequirements,
>(
	base: EffectProcedureRequestServices<BaseContext, BaseRequirements, BaseError>,
	additional: (context: Context) => EffectLayer.Layer<AdditionalRequirements, AdditionalError, AdditionalDependencies>,
): EffectProcedureRequestServices<Context, BaseRequirements | AdditionalRequirements, BaseError | AdditionalError> =>
	makeRequestServices((context: Context) => Layer.provideMerge(additional(context), base.layer(context)));
