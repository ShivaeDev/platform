import { type Context, type Effect, Layer, type Scope } from "effect";

export type AnyTestLayer = Layer.Layer<any, any, never> | Layer.Layer<never, any, never>;

// Only a Layer that provides never takes every test Layer, Layer.empty included, so the overload restores what the given Layer provides.
export function buildTestLayer<TLayer extends AnyTestLayer>(
	layer: TLayer,
	scope: Scope.Scope,
): Effect.Effect<Context.Context<Layer.Success<TLayer>>, unknown>;
export function buildTestLayer(layer: Layer.Layer<never, unknown, never>, scope: Scope.Scope): Effect.Effect<Context.Context<never>, unknown> {
	return Layer.buildWithScope(layer, scope);
}
