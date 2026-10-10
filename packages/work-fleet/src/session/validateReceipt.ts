import { Effect } from "effect";
import { type ReconcileSession, SessionFailure, type SessionReceipt } from "#session/schema.ts";
export function validateReceipt(actual: SessionReceipt, known: Pick<ReconcileSession, "sessionId" | "turnId">) {
	return (known.sessionId !== undefined && actual.sessionId !== known.sessionId) || (known.turnId !== undefined && actual.turnId !== known.turnId)
		? Effect.fail(
				new SessionFailure({ message: "Provider receipt differs from the persisted session or turn; retain reservation", reason: "ambiguous" }),
			)
		: Effect.void;
}
