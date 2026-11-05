import { Clock, Effect } from "effect";
import type { Headers } from "effect/http";
import type { initialize } from "./initialize.ts";

export function observe(state: Effect.Success<typeof initialize>) {
	return Effect.fn("DiscordRestLimits.observe")(function* (route: string, major: string, headers: Headers.Headers) {
		const bucket = headers["x-ratelimit-bucket"];
		if (bucket !== undefined) {
			state.routes.set(route, bucket);
		}
		if (headers["x-ratelimit-remaining"] === "0") {
			state.blocked.set(
				`${state.routes.get(route) ?? route}:${major}`,
				(yield* Clock.currentTimeMillis) + Number(headers["x-ratelimit-reset-after"] ?? 0) * 1000,
			);
		}
	});
}
