import { Cause, Predicate, Schema } from "effect";
import { JobFailure } from "#JobFailure.ts";

export function failureOutput(cause: Cause.Cause<unknown>): typeof JobFailure.Encoded {
	const error = Cause.squash(cause);
	const tag = Predicate.hasProperty(error, "_tag") && typeof error._tag === "string" ? error._tag : "Error";
	const message = Predicate.hasProperty(error, "message") && typeof error.message === "string" ? error.message : String(error);
	return Schema.encodeSync(JobFailure)({ _tag: tag, message });
}
