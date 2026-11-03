import { Effect, Layer, Scope } from "effect";
import type { hostProcessReadouts } from "#testing/hostProcessReadouts.ts";

export function observeFinalizers(readouts: Effect.Success<typeof hostProcessReadouts>, names: ReadonlyMap<object, string>): Layer.MemoMap {
	const memo = Layer.makeMemoMapUnsafe();
	const observed: Layer.MemoMap = {
		"~effect/Layer/MemoMap": "~effect/Layer/MemoMap",
		get: (layer, scope) => memo.get(layer, scope),
		getOrElseMemoize: (layer, scope, build) =>
			memo.getOrElseMemoize(layer, scope, (_, owned) =>
				Effect.gen(function* () {
					const name = names.get(layer);
					if (name !== undefined) {
						// Registered first, this observation runs after the layer releases its resources.
						yield* Scope.addFinalizer(owned, readouts.finalizer(name, Effect.void));
					}
					return yield* build(observed, owned);
				}),
			),
	};
	return observed;
}
