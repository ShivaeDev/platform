import { Clock, Effect, Ref } from "effect";
import type { initialize } from "#rest-limits/initialize.ts";

export function wait(state: Effect.Success<typeof initialize>) {
	return Effect.fn("DiscordRestLimits.wait")(function* (route: string, major: string) {
		const reset = Math.max(yield* Ref.get(state.globalReset), state.blocked.get(`${state.routes.get(route) ?? route}:${major}`) ?? 0);
		const delay = reset - (yield* Clock.currentTimeMillis);
		if (delay > 0) {
			yield* Effect.sleep(delay);
		}
	});
}
