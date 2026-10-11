import { Clock, Effect } from "effect";
import type { TurnsResponse } from "#providers/codexProtocol.ts";
import { failure } from "#providers/codexRpc.ts";
import type { SessionFailure } from "#session/schema.ts";

type ReadPage = (sessionId: string, cursor: string | null) => Effect.Effect<typeof TurnsResponse.Type, SessionFailure>;

export function makeWaitUntilIdle(readPage: ReadPage) {
	const hasActiveTurn = Effect.fn("Codex.hasActiveTurn")(function* (sessionId: string) {
		let cursor: string | null = null;
		let running = false;
		const cursors = new Set<string>();
		do {
			const page: typeof TurnsResponse.Type = yield* readPage(sessionId, cursor);
			running ||= page.data.some((turn) => turn.status === "inProgress");
			cursor = page.nextCursor;
			if (cursor !== null) {
				if (cursors.has(cursor)) {
					return yield* failure("protocol", "Codex repeated a turn pagination cursor");
				}
				cursors.add(cursor);
			}
		} while (cursor !== null);
		return running;
	});
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
