import type { SessionFailure } from "#session/schema.ts";

export function genericRejection(error: SessionFailure) {
	return (
		error.reason === "rejected"
		&& error.code === "session-rejected"
		&& error.capacity === undefined
		&& /^Codex rejected the protocol request(?::\s*(?:(?:Something went wrong|Internal (?:server )?error)\.?)?(?:\s+Request ID:\s*\S+)?)?$/iu.test(
			error.message,
		)
	);
}
