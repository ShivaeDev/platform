import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { untilTimer, watchedClock } from "@shivaedev/test-story/server/watchedClock.ts";
import { type HostState, io } from "./state.ts";

export function healthVerbs(state: HostState, tell: (line: string) => void) {
	function health() {
		tell("the health monitor probes the host");
		return io(async () => {
			const response = await fetch(`${state.url}/health`, { headers: { origin: "https://health-monitor.example" } });
			return { body: await response.text(), cacheControl: response.headers.get("cache-control"), status: response.status };
		});
	}
	return {
		health,
		healthAfterProbeDeadline: () => {
			tell("the health monitor probes the stalled database and its two-second deadline passes");
			return Effect.gen(function* () {
				yield* watchedClock;
				const answer = yield* health().pipe(Effect.forkChild);
				yield* untilTimer("2 seconds");
				yield* TestClock.adjust("2 seconds");
				return yield* Fiber.join(answer);
			}).pipe(Effect.scoped);
		},
	};
}
