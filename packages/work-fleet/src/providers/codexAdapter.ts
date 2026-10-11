import { Effect, Schema } from "effect";
import { ThreadResponse, TurnResponse } from "#providers/codexProtocol.ts";
import { decode, failure } from "#providers/codexRpc.ts";
import { echoedSettings, settingsParams } from "#providers/codexSettings.ts";
import { type CodexRequest, codexTurns } from "#providers/codexTurns.ts";
import type { ContinueSession, ReconcileSession, SessionFailure, SessionObservation, SessionReceipt, StartSession } from "#session/schema.ts";
import { ProviderCapacity } from "#session/schema.ts";
import type { SessionTransport } from "#session/service.ts";

export interface CodexDialect {
	readonly beforeTurn: (input: ContinueSession) => Effect.Effect<Record<string, unknown>, SessionFailure>;
	readonly provisioning: SessionObservation["provisioning"];
	readonly sessionStarted?: (sessionId: string) => void;
	readonly threadStart: (input: StartSession) => Record<string, unknown>;
}
export function codexAdapter(rpc: CodexRequest, dialect: CodexDialect): typeof SessionTransport.Service {
	const terminal = new Map<string, SessionObservation>();
	const { findTurn, operationTurn, readOutput } = codexTurns(rpc);
	return {
		interrupt: Effect.fn("Codex.interrupt")(function* (receipt: SessionReceipt) {
			yield* rpc("turn/interrupt", { threadId: receipt.sessionId, turnId: receipt.turnId }, true);
			return receipt;
		}),
		observe: Effect.fn("Codex.observe")(function* (receipt) {
			const key = `${receipt.sessionId}/${receipt.turnId}`;
			const cached = terminal.get(key);
			if (cached !== undefined) {
				return cached;
			}
			const turn = yield* findTurn(receipt.sessionId, receipt.turnId);
			const output = turn.status === "inProgress" ? "" : yield* readOutput(receipt);
			const capacity = Schema.decodeUnknownOption(ProviderCapacity)(turn.error?.codexErrorInfo);
			const observation: SessionObservation = {
				...(capacity._tag === "Some" && turn.status === "failed" ? { capacity: capacity.value } : {}),
				execution: turn.status === "inProgress" ? "running" : turn.status,
				output,
				provisioning: dialect.provisioning,
				receipt,
				...(turn.error === undefined || turn.error === null ? {} : { error: turn.error.message }),
			};
			if (observation.execution !== "running") {
				terminal.set(key, observation);
			}
			return observation;
		}),
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
			return { sessionId: input.sessionId, turnId: yield* operationTurn(input.sessionId, input.operationId) };
		}),
		startSession: Effect.fn("Codex.startSession")(function* (input) {
			const result = yield* rpc("thread/start", dialect.threadStart(input), true).pipe(Effect.flatMap((value) => decode(ThreadResponse, value)));
			dialect.sessionStarted?.(result.thread.id);
			yield* echoedSettings(input.settings, result).pipe(
				Effect.mapError((error) => failure("ambiguous", `${error.message}; retain the started session reservation`)),
			);
			return result.thread.id;
		}),
		startTurn: Effect.fn("Codex.startTurn")(function* (input: ContinueSession) {
			const extra = yield* dialect.beforeTurn(input);
			const result = yield* rpc(
				"turn/start",
				{
					...extra,
					...settingsParams(input.settings),
					clientUserMessageId: input.operationId,
					input: [{ text: input.prompt, "text_elements": [], type: "text" }],
					threadId: input.sessionId,
				},
				true,
			).pipe(Effect.flatMap((value) => decode(TurnResponse, value)));
			return { sessionId: input.sessionId, turnId: result.turn.id };
		}),
	};
}
