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
	function missingTurn(threadIdle: boolean) {
		return new SessionFailure({
			code: "session-turn-missing",
			message: "No matching accepted turn is observable; absence does not authorize replay",
			reason: "ambiguous",
			threadIdle,
		});
	}
	const operations = new Map<string, Recovery>();
	function resumeMissingTurn(input: ContinueSession, replayable: boolean, idle: boolean) {
		return replayable ? startTurn(input) : Effect.fail(missingTurn(idle));
	}
	const recover = Effect.fn("Codex.recover")(function* (input: ReconcileSession & { readonly sessionId: string }) {
		const deadline = (yield* Clock.currentTimeMillis) + (graceMs ?? 0);
		let emptyThread = true;
		let idleThread = true;
		while (true) {
			const { empty, idle, turnId } = yield* operationTurn(input.sessionId, input.operationId);
			emptyThread = emptyThread && empty;
			idleThread = idleThread && idle;
			if (turnId !== undefined) {
				return { sessionId: input.sessionId, turnId };
			}
			if (graceMs === undefined || input.resume === undefined) {
				return yield* Effect.fail(missingTurn(idle));
			}
			const remaining = deadline - (yield* Clock.currentTimeMillis);
			if (remaining <= 0) {
				return yield* resumeMissingTurn(
					{ ...input.resume, operationId: input.operationId, sessionId: input.sessionId },
					replayableThread(input.resume.afterTimeout, emptyThread, idleThread),
					idle,
				);
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

function replayableThread(afterTimeout: boolean | undefined, empty: boolean, idle: boolean) {
	return empty || (afterTimeout === true && idle);
}
