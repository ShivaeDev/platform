import { Clock, Effect } from "effect";
import type { Headers } from "effect/http";

export function rateLimits() {
	const routes = new Map<string, string>();
	const blocked = new Map<string, number>();
	let globalReset = 0;
	function key(route: string, major: string) {
		return `${routes.get(route) ?? route}:${major}`;
	}
	return {
		observe: (route: string, major: string, headers: Headers.Headers) =>
			Effect.gen(function* () {
				const bucket = headers["x-ratelimit-bucket"];
				if (bucket !== undefined) {
					routes.set(route, bucket);
				}
				if (headers["x-ratelimit-remaining"] === "0") {
					blocked.set(key(route, major), (yield* Clock.currentTimeMillis) + Number(headers["x-ratelimit-reset-after"] ?? 0) * 1000);
				}
			}),
		refuse: (route: string, major: string, seconds: number, global: boolean) =>
			Effect.gen(function* () {
				const reset = (yield* Clock.currentTimeMillis) + seconds * 1000;
				if (global) {
					globalReset = Math.max(globalReset, reset);
				} else {
					blocked.set(key(route, major), reset);
				}
			}),
		wait: (route: string, major: string) =>
			Effect.gen(function* () {
				const delay = Math.max(globalReset, blocked.get(key(route, major)) ?? 0) - (yield* Clock.currentTimeMillis);
				if (delay > 0) {
					yield* Effect.sleep(delay);
				}
			}),
	};
}
