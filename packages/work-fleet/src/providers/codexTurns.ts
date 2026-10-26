import { Effect } from "effect";
import { type Item, ItemsResponse, type Turn, TurnsResponse } from "#providers/codexProtocol.ts";
import { decode, failure } from "#providers/codexRpc.ts";
import { makeWaitUntilIdle } from "#providers/makeWaitUntilIdle.ts";
import { readActiveTurn } from "#providers/readActiveTurn.ts";
import { reportLimit } from "#reportLimits.ts";
import { SessionFailure, type SessionReceipt } from "#session/schema.ts";

export interface Progress {
	readonly id: string;
	readonly status?: string | undefined;
}
export type CodexRequest = (method: string, params: unknown, mutation?: boolean) => Effect.Effect<unknown, SessionFailure>;
export function finalOutput(items: readonly (typeof Item.Type)[]) {
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
	const latestItem = Effect.fn("Codex.latestItem")(function* (sessionId: string, turnId: string) {
		const page: typeof ItemsResponse.Type = yield* rpc("thread/items/list", {
			cursor: null,
			limit: 1,
			sortDirection: "desc",
			threadId: sessionId,
			turnId,
		}).pipe(Effect.flatMap((value) => decode(ItemsResponse, value)));
		return page.data[0]?.item;
	});
	const readTurn = Effect.fn("Codex.readTurn")(function* (sessionId: string, turnId: string) {
		let cursor: string | null = null;
		const cursors = new Set<string>();
		const progress: Progress[] = [];
		do {
			const page: typeof TurnsResponse.Type = yield* turns(sessionId, cursor, false);
			const found = page.data.find((turn) => turn.id === turnId);
			if (found !== undefined) {
				return { progress, turn: found };
			}
			for (const turn of page.data.filter((entry) => entry.status === "inProgress")) {
				progress.push({ id: turn.id, status: turn.status });
				const item = yield* latestItem(sessionId, turn.id);
				if (item !== undefined) {
					progress.push({ id: `${turn.id}/${item.id}`, status: item.status });
				}
			}
			cursor = page.nextCursor;
			yield* rememberCursor(cursors, cursor, "Codex repeated a turn pagination cursor");
		} while (cursor !== null);
		return { progress, turn: undefined };
	});
	const findTurn = Effect.fn("Codex.findTurn")(function* (sessionId: string, turnId: string) {
		const { turn } = yield* readTurn(sessionId, turnId);
		return (
			turn
			?? (yield* new SessionFailure({
				code: "session-turn-missing",
				message: "The acknowledged Codex turn is not observable",
				reason: "ambiguous",
			}))
		);
	});
	const waitUntilIdle = makeWaitUntilIdle((sessionId, cursor) => turns(sessionId, cursor, false));
	const operationTurn = Effect.fn("Codex.operationTurn")(function* (sessionId: string, operationId: string) {
		let cursor: string | null = null;
		const matching: (typeof Turn.Type)[] = [];
		const cursors = new Set<string>();
		let empty = true;
		let idle = true;
		do {
			const page: typeof TurnsResponse.Type = yield* turns(sessionId, cursor, true);
			empty = empty && page.data.length === 0;
			idle = idle && page.data.every((turn) => turn.status === "completed" || turn.status === "failed" || turn.status === "interrupted");
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
		return { empty, idle, turnId };
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
	return {
		findTurn,
		hasActiveTurn: readActiveTurn((sessionId, cursor) => turns(sessionId, cursor, false)),
		latestItem,
		operationTurn,
		readItems,
		readTurn,
		waitUntilIdle,
	};
}
