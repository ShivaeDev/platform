import { Effect } from "effect";
import { ThreadResponse } from "#providers/codexProtocol.ts";
import { decode, failure } from "#providers/codexRpc.ts";
import { echoedSettings, settingsParams } from "#providers/codexSettings.ts";
import { type CodexRequest, codexTurns } from "#providers/codexTurns.ts";
import { observeCodexTurn } from "#providers/observeCodexTurn.ts";
import { recoverTurn } from "#providers/recoverTurn.ts";
import { startCodexTurn } from "#providers/startCodexTurn.ts";
import type { ContinueSession, ReconcileSession, SessionFailure, SessionObservation, SessionReceipt, StartSession } from "#session/schema.ts";
import type { SessionTransport } from "#session/service.ts";

export interface CodexDialect {
	readonly beforeTurn: (input: ContinueSession) => Effect.Effect<Record<string, unknown>, SessionFailure>;
	readonly provisioning: SessionObservation["provisioning"];
	readonly recoveryGraceMs?: number;
	readonly sessionStarted?: (sessionId: string) => void;
	readonly threadStart: (input: StartSession) => Record<string, unknown>;
}
export function codexAdapter(rpc: CodexRequest, dialect: CodexDialect): typeof SessionTransport.Service {
	const turns = codexTurns(rpc);
	const { findTurn, operationTurn, waitUntilIdle } = turns;
	const submitTurn = startCodexTurn(rpc, waitUntilIdle);
	const startTurn = Effect.fn("Codex.startTurn")(function* (input: ContinueSession) {
		const extra = yield* dialect.beforeTurn(input);
		const result = yield* submitTurn(input.sessionId, {
			...extra,
			...settingsParams(input.settings),
			clientUserMessageId: input.operationId,
			input: [{ text: input.prompt, "text_elements": [], type: "text" }],
			threadId: input.sessionId,
		});
		return { sessionId: input.sessionId, turnId: result.turn.id };
	});
	const recover = recoverTurn(operationTurn, startTurn, dialect.recoveryGraceMs);
	return {
		interrupt: Effect.fn("Codex.interrupt")(function* (receipt: SessionReceipt) {
			yield* rpc("turn/interrupt", { threadId: receipt.sessionId, turnId: receipt.turnId }, true);
			return receipt;
		}),
		observe: observeCodexTurn(turns, dialect.provisioning),
		reconcile: Effect.fn("Codex.reconcile")(function* (input: ReconcileSession) {
			if (input.sessionId === undefined) {
				return yield* Effect.fail(
					failure("ambiguous", "Lost thread acknowledgement cannot be reconciled by this Codex protocol; retain reservation"),
				);
			}
			if (input.turnId !== undefined) {
				yield* findTurn(input.sessionId, input.turnId);
				return { sessionId: input.sessionId, turnId: input.turnId };
			}
			return yield* recover({ ...input, sessionId: input.sessionId });
		}),
		startSession: Effect.fn("Codex.startSession")(function* (input) {
			const result = yield* rpc("thread/start", dialect.threadStart(input), true).pipe(Effect.flatMap((value) => decode(ThreadResponse, value)));
			dialect.sessionStarted?.(result.thread.id);
			yield* echoedSettings(input.settings, result).pipe(
				Effect.mapError((error) => failure("ambiguous", `${error.message}; retain the started session reservation`)),
			);
			return result.thread.id;
		}),
		startTurn,
		steer: (receipt, prompt) =>
			rpc(
				"turn/steer",
				{
					expectedTurnId: receipt.turnId,
					input: [{ text: prompt, "text_elements": [], type: "text" }],
					threadId: receipt.sessionId,
				},
				true,
			).pipe(
				Effect.asVoid,
				Effect.catch((error) =>
					error.reason === "rejected" && error.message.endsWith("failed to steer turn: NoActiveTurn") ? Effect.void : Effect.fail(error),
				),
			),
	};
}
