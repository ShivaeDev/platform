import { Clock, Effect, Ref } from "effect";
import type { initialize } from "#rest-limits/initialize.ts";

export function refuse(state: Effect.Success<typeof initialize>) {
	return Effect.fn("DiscordRestLimits.refuse")(function* (route: string, major: string, seconds: number, global: boolean) {
		const reset = (yield* Clock.currentTimeMillis) + seconds * 1000;
		if (global) {
			yield* Ref.update(state.globalReset, (previous) => Math.max(previous, reset));
		} else {
			state.blocked.set(`${state.routes.get(route) ?? route}:${major}`, reset);
		}
	});
}
