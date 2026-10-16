import type { SessionFailure } from "./schema.ts";

function providerMessage(message: string) {
	return message
		.toLowerCase()
		.replace(/^codex rejected the protocol request: /u, "")
		.replace(/\.$/u, "");
}

export function busyThread(error: Pick<SessionFailure, "code" | "message">) {
	return (
		error.code === "session-active-turn"
		|| error.code === "session-active-turn-exhausted"
		|| providerMessage(error.message) === "turn already active for thread"
	);
}

export function transientFailure(error: SessionFailure) {
	return (
		error.reason === "rejected"
		&& (error.capacity !== undefined
			|| error.code === "session-queue-full"
			|| busyThread(error)
			|| providerMessage(error.message).startsWith("selected model is at capacity"))
	);
}

export function requestTimedOut(error: SessionFailure) {
	return (
		(error.reason === "ambiguous" || error.reason === "unavailable") && error.message === "Codex request timed out; preserve submission ownership"
	);
}
