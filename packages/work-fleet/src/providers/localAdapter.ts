import { Effect } from "effect";
import { ItemsResponse, ThreadResponse, TurnResponse, TurnsResponse } from "#providers/codexProtocol.ts";
import { type CodexConnection, decode, failure, request } from "#providers/codexRpc.ts";
import type { ContinueSession, ReconcileSession, SessionObservation, SessionReceipt } from "#session/schema.ts";
import type { SessionTransport } from "#session/service.ts";
export function localAdapter(connection: CodexConnection, timeoutMs: number): typeof SessionTransport.Service {
	const terminal = new Map<string, SessionObservation>();
	const resumed = new Set<string>();
	function rpc(method: string, params: unknown, mutation = false) {
		return request(connection, timeoutMs, method, params, mutation);
	}
	function turns(sessionId: string, cursor: string | null, full = false) {
		return rpc("thread/turns/list", {
			cursor,
			itemsView: full ? "full" : "summary",
			limit: 100,
			sortDirection: "desc",
			threadId: sessionId,
		}).pipe(Effect.flatMap((value) => decode(TurnsResponse, value)));
	}
	const findTurn = Effect.fn("CodexLocal.findTurn")(function* (sessionId: string, turnId: string) {
		let cursor: string | null = null;
		do {
			const page: typeof TurnsResponse.Type = yield* turns(sessionId, cursor);
			const found = page.data.find((turn) => turn.id === turnId);
			if (found !== undefined) {
				return found;
			}
			cursor = page.nextCursor;
		} while (cursor !== null);
		return yield* Effect.fail(failure("ambiguous", "The acknowledged Codex turn is not observable"));
	});
	const startTurn = Effect.fn("CodexLocal.startTurn")(function* (input: ContinueSession) {
		if (!resumed.has(input.sessionId)) {
			yield* rpc("thread/resume", { excludeTurns: true, threadId: input.sessionId });
			resumed.add(input.sessionId);
		}
		const result = yield* rpc(
			"turn/start",
			{
				clientUserMessageId: input.operationId,
				input: [{ text: input.prompt, "text_elements": [], type: "text" }],
				threadId: input.sessionId,
			},
			true,
		).pipe(Effect.flatMap((value) => decode(TurnResponse, value)));
		return { sessionId: input.sessionId, turnId: result.turn.id };
	});
	const readOutput = Effect.fn("CodexLocal.readOutput")(function* (receipt: SessionReceipt, isTerminal: boolean) {
		let cursor: string | null = null;
		const output: string[] = [];
		if (isTerminal) {
			do {
				const page: typeof ItemsResponse.Type = yield* rpc("thread/items/list", {
					cursor,
					limit: 100,
					threadId: receipt.sessionId,
					turnId: receipt.turnId,
				}).pipe(Effect.flatMap((value) => decode(ItemsResponse, value)));
				for (const { item } of page.data) {
					if (item.type === "agentMessage" && item.text !== undefined) {
						output.push(item.text);
					}
				}
				cursor = page.nextCursor;
			} while (cursor !== null);
		}
		return output.join("\n");
	});
	return {
		interrupt: Effect.fn("CodexLocal.interrupt")(function* (receipt: SessionReceipt) {
			yield* rpc("turn/interrupt", { threadId: receipt.sessionId, turnId: receipt.turnId }, true);
			return receipt;
		}),
		observe: Effect.fn("CodexLocal.observe")(function* (receipt) {
			const key = `${receipt.sessionId}/${receipt.turnId}`;
			const cached = terminal.get(key);
			if (cached !== undefined) {
				return cached;
			}
			const turn = yield* findTurn(receipt.sessionId, receipt.turnId);
			const output = yield* readOutput(receipt, turn.status !== "inProgress");
			const observation: SessionObservation = {
				execution: turn.status === "inProgress" ? "running" : turn.status,
				output,
				provisioning: "ready",
				receipt,
				...(turn.error === undefined || turn.error === null ? {} : { error: turn.error.message }),
			};
			if (observation.execution !== "running") {
				terminal.set(key, observation);
			}
			return observation;
		}),
		reconcile: Effect.fn("CodexLocal.reconcile")(function* (input: ReconcileSession) {
			if (input.sessionId === undefined) {
				return yield* Effect.fail(
					failure("ambiguous", "Lost thread acknowledgement cannot be reconciled by this Codex protocol; retain reservation"),
				);
			}
			if (input.turnId !== undefined) {
				yield* findTurn(input.sessionId, input.turnId);
				return { sessionId: input.sessionId, turnId: input.turnId };
			}
			let cursor: string | null = null;
			const matching: string[] = [];
			do {
				const page: typeof TurnsResponse.Type = yield* turns(input.sessionId, cursor, true);
				matching.push(
					...page.data
						.filter((turn) => turn.items.some((item) => item.type === "userMessage" && item.clientId === input.operationId))
						.map((turn) => turn.id),
				);
				if (matching.length > 1) {
					return yield* Effect.fail(failure("ambiguous", "Multiple Codex turns match one operation; retain reservation"));
				}
				cursor = page.nextCursor;
			} while (cursor !== null);
			const [turnId] = matching;
			if (matching.length === 1 && turnId !== undefined) {
				return { sessionId: input.sessionId, turnId };
			}
			return yield* Effect.fail(failure("ambiguous", "No matching accepted turn is observable; absence does not authorize replay"));
		}),
		startSession: Effect.fn("CodexLocal.startSession")(function* (input) {
			const result = yield* rpc("thread/start", { cwd: input.cwd, ephemeral: false, model: input.model }, true).pipe(
				Effect.flatMap((value) => decode(ThreadResponse, value)),
			);
			resumed.add(result.thread.id);
			return result.thread.id;
		}),
		startTurn,
	};
}
