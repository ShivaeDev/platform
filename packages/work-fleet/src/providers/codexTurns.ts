import { Effect } from "effect";
import { type Item, ItemsResponse, TurnsResponse } from "#providers/codexProtocol.ts";
import { decode, failure } from "#providers/codexRpc.ts";
import type { SessionFailure, SessionReceipt } from "#session/schema.ts";

export type CodexRequest = (method: string, params: unknown, mutation?: boolean) => Effect.Effect<unknown, SessionFailure>;
function finalOutput(items: readonly (typeof Item.Type)[]) {
	const messages = items.filter((item) => item.type === "agentMessage" && item.text !== undefined);
	const final = messages.filter((item) => item.phase === "final_answer");
	return (final.length > 0 ? final : messages).map((item) => item.text).join("\n");
}
export function codexTurns(rpc: CodexRequest) {
	function turns(sessionId: string, cursor: string | null, full: boolean) {
		return rpc("thread/turns/list", {
			cursor,
			itemsView: full ? "full" : "notLoaded",
			limit: 100,
			sortDirection: "desc",
			threadId: sessionId,
		}).pipe(Effect.flatMap((value) => decode(TurnsResponse, value)));
	}
	const findTurn = Effect.fn("Codex.findTurn")(function* (sessionId: string, turnId: string) {
		let cursor: string | null = null;
		do {
			const page: typeof TurnsResponse.Type = yield* turns(sessionId, cursor, false);
			const found = page.data.find((turn) => turn.id === turnId);
			if (found !== undefined) {
				return found;
			}
			cursor = page.nextCursor;
		} while (cursor !== null);
		return yield* Effect.fail(failure("ambiguous", "The acknowledged Codex turn is not observable"));
	});
	const operationTurn = Effect.fn("Codex.operationTurn")(function* (sessionId: string, operationId: string) {
		let cursor: string | null = null;
		const matching: string[] = [];
		let empty = true;
		do {
			const page: typeof TurnsResponse.Type = yield* turns(sessionId, cursor, true);
			empty = empty && page.data.length === 0;
			matching.push(
				...page.data.filter((turn) => turn.items.some((item) => item.type === "userMessage" && item.clientId === operationId)).map((turn) => turn.id),
			);
			if (matching.length > 1) {
				return yield* Effect.fail(failure("ambiguous", "Multiple Codex turns match one operation; retain reservation"));
			}
			cursor = page.nextCursor;
		} while (cursor !== null);
		const [turnId] = matching;
		if (turnId === undefined && !empty) {
			return yield* Effect.fail(failure("ambiguous", "No matching accepted turn is observable; absence does not authorize replay"));
		}
		return turnId;
	});
	const readOutput = Effect.fn("Codex.readOutput")(function* (receipt: SessionReceipt) {
		let cursor: string | null = null;
		const items: (typeof Item.Type)[] = [];
		do {
			const page: typeof ItemsResponse.Type = yield* rpc("thread/items/list", {
				cursor,
				limit: 100,
				threadId: receipt.sessionId,
				turnId: receipt.turnId,
			}).pipe(Effect.flatMap((value) => decode(ItemsResponse, value)));
			items.push(...page.data.map(({ item }) => item));
			cursor = page.nextCursor;
		} while (cursor !== null);
		return finalOutput(items);
	});
	return { findTurn, operationTurn, readOutput };
}
