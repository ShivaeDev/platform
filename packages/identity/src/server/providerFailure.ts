import { Cause, Effect, Schema } from "effect";
import { redact } from "@shivaedev/errors/redact.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";

export function providerFailure(cause: unknown) {
	if (Schema.is(AuthUnavailable)(cause)) {
		return Effect.fail(cause);
	}
	return Effect.andThen(
		Effect.logError("Authentication provider failed", redact(Cause.isUnknownError(cause) ? cause.cause : cause)),
		Effect.fail(new AuthUnavailable({ message: "Authentication is temporarily unavailable" })),
	);
}
