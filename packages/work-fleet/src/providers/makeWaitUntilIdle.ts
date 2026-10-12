import { Clock, Effect } from "effect";
import { type ReadTurnPage, readActiveTurn } from "#providers/readActiveTurn.ts";

export function makeWaitUntilIdle(readPage: ReadTurnPage) {
	const hasActiveTurn = readActiveTurn(readPage);
	const poll = Effect.fn("Codex.poll")(function* (sessionId: string, deadline: number) {
		let delay = 2000;
		while ((yield* Clock.currentTimeMillis) < deadline) {
			if (!(yield* hasActiveTurn(sessionId))) {
				return (yield* Clock.currentTimeMillis) < deadline;
			}
			const remaining = deadline - (yield* Clock.currentTimeMillis);
			if (remaining <= 0) {
				return false;
			}
			yield* Effect.sleep(Math.min(delay, remaining));
			delay = Math.min(30_000, delay * 2);
		}
		return false;
	});
	return Effect.fn("Codex.waitUntilIdle")(function* (sessionId: string, deadline: number) {
		const remaining = deadline - (yield* Clock.currentTimeMillis);
		return remaining <= 0
			? false
			: yield* poll(sessionId, deadline).pipe(
					Effect.timeout(`${remaining} millis`),
					Effect.catchTag("TimeoutError", () => Effect.succeed(false)),
				);
	});
}
