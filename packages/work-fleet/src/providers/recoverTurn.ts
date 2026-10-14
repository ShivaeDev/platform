import { Clock, Effect, Semaphore } from "effect";
import type { codexTurns } from "#providers/codexTurns.ts";
import { type ContinueSession, type ReconcileSession, SessionFailure, type SessionReceipt } from "#session/schema.ts";

interface Recovery {
	readonly lock: Semaphore.Semaphore;
	receipt?: SessionReceipt;
}

export function recoverTurn(
	operationTurn: ReturnType<typeof codexTurns>["operationTurn"],
	startTurn: (input: ContinueSession) => Effect.Effect<SessionReceipt, SessionFailure>,
	graceMs?: number,
) {
	function missingTurn() {
		return new SessionFailure({
			code: "session-turn-missing",
			message: "No matching accepted turn is observable; absence does not authorize replay",
			reason: "ambiguous",
		});
	}
	const operations = new Map<string, Recovery>();
	function resumeEmptyThread(input: ContinueSession, emptyThread: boolean) {
		return emptyThread ? startTurn(input) : Effect.fail(missingTurn());
	}
	const recover = Effect.fn("Codex.recover")(function* (input: ReconcileSession & { readonly sessionId: string }) {
		const deadline = (yield* Clock.currentTimeMillis) + (graceMs ?? 0);
		let emptyThread = true;
		while (true) {
			const { empty, turnId } = yield* operationTurn(input.sessionId, input.operationId);
			emptyThread = emptyThread && empty;
			if (turnId !== undefined) {
				return { sessionId: input.sessionId, turnId };
			}
			if (graceMs === undefined || input.resume === undefined) {
				return yield* Effect.fail(missingTurn());
			}
			const remaining = deadline - (yield* Clock.currentTimeMillis);
			if (remaining <= 0) {
				return yield* resumeEmptyThread({ ...input.resume, operationId: input.operationId, sessionId: input.sessionId }, emptyThread);
			}
			yield* Effect.sleep(Math.min(250, remaining));
		}
	});
	const recoverOnce = Effect.fn("Codex.recoverOnce")(function* (input: ReconcileSession & { readonly sessionId: string }, state: Recovery) {
		if (state.receipt !== undefined) {
			return state.receipt;
		}
		const receipt = yield* recover(input);
		state.receipt = receipt;
		return receipt;
	});
	return (input: ReconcileSession & { readonly sessionId: string }) =>
		Effect.suspend(() => {
			const key = JSON.stringify([input.sessionId, input.operationId]);
			const state: Recovery = operations.get(key) ?? { lock: Semaphore.makeUnsafe(1) };
			operations.set(key, state);
			return Semaphore.withPermit(state.lock)(recoverOnce(input, state));
		});
}
