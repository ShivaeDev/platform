import { Context, Effect, Layer } from "effect";
import type * as Reactivity from "effect/reactivity/Reactivity";
import { CommandGuard } from "@shivaedev/contract/CommandGuard.ts";
import type { liveServerLayer } from "@shivaedev/contract/live-server/layer.ts";

export type LiveChannel = Layer.Success<typeof liveServerLayer> | Reactivity.Reactivity;

// A kit's transport runs each request outside the host's Layer context, so the command guard publishes on the channel it was built with.
export function onChannel<TGuards>(guards: Layer.Layer<TGuards | CommandGuard>) {
	return Layer.effectContext(
		Effect.gen(function* () {
			const channel = yield* Effect.context<LiveChannel>();
			const built = yield* Layer.build(guards);
			const guard = Context.get(built, CommandGuard);
			return Context.add(built, CommandGuard, (effect, options) => Effect.provideContext(guard(effect, options), channel));
		}),
	);
}
