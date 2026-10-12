import { Effect } from "effect";
import type { TurnsResponse } from "#providers/codexProtocol.ts";
import { failure } from "#providers/codexRpc.ts";
import type { SessionFailure } from "#session/schema.ts";

export type ReadTurnPage = (sessionId: string, cursor: string | null) => Effect.Effect<typeof TurnsResponse.Type, SessionFailure>;

export function readActiveTurn(readPage: ReadTurnPage) {
	return Effect.fn("Codex.hasActiveTurn")(function* (sessionId: string) {
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
}
