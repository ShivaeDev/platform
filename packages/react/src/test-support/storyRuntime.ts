import { Clock, Effect, Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";

export const storyRuntime = Effect.map(Clock.Clock, (clock) => {
	const runtime = Atom.context();
	runtime.addGlobalLayer(Layer.succeed(Clock.Clock, clock));
	return runtime;
});
