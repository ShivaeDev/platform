import { type Layer as EffectLayer, Layer } from "effect";

export interface EffectProcedureRequestServices<
	Context,
	Requirements,
	Error = never,
> {
	readonly layer: (context: Context) => EffectLayer.Layer<Requirements, Error>;
}

export const makeRequestServices = <Context, Requirements, Error = never>(
	layer: (context: Context) => EffectLayer.Layer<Requirements, Error>,
): EffectProcedureRequestServices<Context, Requirements, Error> => ({ layer });

export const extendRequestServices = <
	BaseContext,
	Context extends BaseContext,
	BaseRequirements,
	BaseError,
	AdditionalRequirements,
	AdditionalError,
	AdditionalDependencies extends BaseRequirements = BaseRequirements,
>(
	base: EffectProcedureRequestServices<
		BaseContext,
		BaseRequirements,
		BaseError
	>,
	additional: (
		context: Context,
	) => EffectLayer.Layer<
		AdditionalRequirements,
		AdditionalError,
		AdditionalDependencies
	>,
): EffectProcedureRequestServices<
	Context,
	BaseRequirements | AdditionalRequirements,
	BaseError | AdditionalError
> =>
	makeRequestServices((context: Context) =>
		Layer.provideMerge(additional(context), base.layer(context)),
	);
