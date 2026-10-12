import { Effect } from "effect";
import { type CodexRequest, codexTurns } from "#providers/codexTurns.ts";
import { startCodexTurn } from "#providers/startCodexTurn.ts";
import { SessionFailure } from "#session/schema.ts";

export function activeTurnRaces(sessionId: string, exhaust = true) {
	let reads = 0;
	const rpc: CodexRequest = (method) =>
		Effect.suspend(() => {
			if (method === "turn/start") {
				return Effect.fail(new SessionFailure({ code: "session-rejected", message: "Another operation owns this thread.", reason: "rejected" }));
			}
			reads += 1;
			return Effect.succeed({ data: [{ id: "steered-turn", items: [], status: reads % 2 === 1 ? "inProgress" : "completed" }], nextCursor: null });
		});
	return startCodexTurn(rpc, exhaust ? codexTurns(rpc).waitUntilIdle : () => Effect.succeed(false))(sessionId, { threadId: sessionId });
}
