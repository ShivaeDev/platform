import { Clock, Effect, Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";

export const clientRuntime = Effect.gen(function* () {
	const runtime = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() });
	runtime.addGlobalLayer(Layer.succeed(Clock.Clock, yield* Clock.Clock));
	return runtime;
});
