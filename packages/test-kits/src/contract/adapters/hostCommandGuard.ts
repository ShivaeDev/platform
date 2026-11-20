import { Effect, Layer } from "effect";
import type * as Reactivity from "effect/reactivity/Reactivity";
import { commandGuardLayer } from "@shivaedev/contract/CommandGuard.ts";
import type { liveServerLayer } from "@shivaedev/contract/live-server/layer.ts";
import { publishCommand } from "@shivaedev/server/publishCommand.ts";

export type LiveChannel = Layer.Success<typeof liveServerLayer> | Reactivity.Reactivity;

// A kit's transport runs each request outside the host's Layer context, so the guard publishes on the channel it was built with.
export function hostCommandGuard() {
	return Layer.unwrap(
		Effect.map(Effect.context<LiveChannel>(), (context) =>
			commandGuardLayer((effect, keys, sync) => Effect.provideContext(publishCommand(effect, keys, sync), context)),
		),
	);
}
