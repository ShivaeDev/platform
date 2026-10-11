import { Effect } from "effect";
import { type Item, ItemsResponse, type Turn, TurnsResponse } from "#providers/codexProtocol.ts";
import { decode, failure } from "#providers/codexRpc.ts";
import { makeWaitUntilIdle } from "#providers/makeWaitUntilIdle.ts";
import { reportLimit } from "#reportLimits.ts";
import { SessionFailure, type SessionReceipt } from "#session/schema.ts";

export type CodexRequest = (method: string, params: unknown, mutation?: boolean) => Effect.Effect<unknown, SessionFailure>;
function finalOutput(items: readonly (typeof Item.Type)[]) {
	const messages = items.filter((item) => item.type === "agentMessage" && item.text !== undefined);
	const final = messages.filter((item) => item.phase === "final_answer");
	return (final.length > 0 ? final : messages).map((item) => item.text).join("\n");
}
function rememberCursor(cursors: Set<string>, cursor: string | null, message = "Codex repeated an item pagination cursor") {
	if (cursor === null) {
		return Effect.void;
	}
	if (cursors.has(cursor)) {
		return Effect.fail(failure("protocol", message));
	}
	cursors.add(cursor);
	return Effect.void;
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
	const waitUntilIdle = makeWaitUntilIdle((sessionId, cursor) => turns(sessionId, cursor, false));
	const operationTurn = Effect.fn("Codex.operationTurn")(function* (sessionId: string, operationId: string) {
		let cursor: string | null = null;
		const matching: (typeof Turn.Type)[] = [];
		const cursors = new Set<string>();
		let empty = true;
		do {
			const page: typeof TurnsResponse.Type = yield* turns(sessionId, cursor, true);
			empty = empty && page.data.length === 0;
			matching.push(...page.data.filter((turn) => turn.items.some((item) => item.type === "userMessage" && item.clientId === operationId)));
			cursor = page.nextCursor;
			yield* rememberCursor(cursors, cursor, "Codex repeated a turn pagination cursor");
		} while (cursor !== null);
		if (matching.length > 1) {
			return yield* Effect.fail(
				new SessionFailure({
					code: "duplicate-turns",
					message: "Multiple Codex turns match one operation; retain reservation",
					reason: "ambiguous",
					...(matching.every((turn) => turn.status !== "inProgress")
						? { terminalReceipts: matching.map((turn) => ({ sessionId, turnId: turn.id })) }
						: {}),
				}),
			);
		}
		const turnId = matching[0]?.id;
		if (turnId === undefined && !empty) {
			return yield* Effect.fail(failure("ambiguous", "No matching accepted turn is observable; absence does not authorize replay"));
		}
		return turnId;
	});
	const readItems = Effect.fn("Codex.readItems")(function* (receipt: SessionReceipt, byteLimit?: number) {
		let cursor: string | null = null;
		const items: (typeof Item.Type)[] = [];
		const cursors = new Set<string>();
		let bytes = 0;
		do {
			const response: unknown = yield* rpc("thread/items/list", {
				cursor,
				limit: 100,
				sortDirection: "asc",
				threadId: receipt.sessionId,
				turnId: receipt.turnId,
			});
			bytes += Buffer.byteLength(JSON.stringify(response) ?? "null", "utf8");
			if (byteLimit !== undefined && bytes > byteLimit) {
				return yield* Effect.fail(failure("protocol", reportLimit("downloadBytes").message));
			}
			const page: typeof ItemsResponse.Type = yield* decode(ItemsResponse, response);
			for (const { item } of page.data) {
				items.push(item);
			}
			cursor = page.nextCursor;
			yield* rememberCursor(cursors, cursor);
		} while (cursor !== null);
		return items;
	});
	function readOutput(receipt: SessionReceipt) {
		return readItems(receipt).pipe(Effect.map(finalOutput));
	}
	return { findTurn, operationTurn, readItems, readOutput, waitUntilIdle };
}
