import type * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Scope from "effect/Scope";

export type AnyTestLayer = Layer.Layer<any, any, never> | Layer.Layer<never, any, never>;

// Only a Layer that provides never takes every test Layer, Layer.empty included, so the overload restores what the given Layer provides.
export function buildTestLayer<TLayer extends AnyTestLayer>(
	layer: TLayer,
): Effect.Effect<Context.Context<Layer.Success<TLayer>>, unknown, Scope.Scope>;
export function buildTestLayer(layer: Layer.Layer<never, unknown, never>): Effect.Effect<Context.Context<never>, unknown, Scope.Scope> {
	return Layer.build(layer);
}
