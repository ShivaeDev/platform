import { Clock, Effect, Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";

export const storyRuntime = Effect.gen(function* () {
	const runtime = Atom.context();
	runtime.addGlobalLayer(Layer.succeed(Clock.Clock, yield* Clock.Clock));
	return runtime;
});
