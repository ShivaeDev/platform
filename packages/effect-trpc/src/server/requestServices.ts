import { type Layer as EffectLayer, Layer } from "effect";
export interface EffectProcedureRequestServices<TContext, TRequirements, TError = never> {
	readonly layer: (context: TContext) => EffectLayer.Layer<TRequirements, TError>;
}
export function makeRequestServices<TContext, TRequirements, TError = never>(
	layer: (context: TContext) => EffectLayer.Layer<TRequirements, TError>,
): EffectProcedureRequestServices<TContext, TRequirements, TError> {
	return { layer };
}
export function extendRequestServices<
	TBaseContext,
	TContext extends TBaseContext,
	TBaseRequirements,
	TBaseError,
	TAdditionalRequirements,
	TAdditionalError,
	TAdditionalDependencies extends TBaseRequirements = TBaseRequirements,
>(
	base: EffectProcedureRequestServices<TBaseContext, TBaseRequirements, TBaseError>,
	additional: (context: TContext) => EffectLayer.Layer<TAdditionalRequirements, TAdditionalError, TAdditionalDependencies>,
): EffectProcedureRequestServices<TContext, TBaseRequirements | TAdditionalRequirements, TBaseError | TAdditionalError> {
	return makeRequestServices((context: TContext) => Layer.provideMerge(additional(context), base.layer(context)));
}
