import { Cause, Predicate, Schema } from "effect";
import { redact } from "@shivaedev/errors/redact.ts";
import { JobFailure } from "#JobFailure.ts";

function summary(error: unknown): string {
	if (Predicate.hasProperty(error, "message") && typeof error.message === "string" && error.message.trim() !== "") {
		return error.message;
	}
	if (Predicate.hasProperty(error, "_tag")) {
		const fields = Object.fromEntries(Object.entries(error).filter(([key]) => !["_tag", "message", "name", "stack", "cause"].includes(key)));
		return JSON.stringify(redact(fields));
	}
	return String(error);
}

export function failureOutput(cause: Cause.Cause<unknown>): typeof JobFailure.Encoded {
	const error = Cause.squash(cause);
	const tag = Predicate.hasProperty(error, "_tag") && typeof error._tag === "string" ? error._tag : "Error";
	return Schema.encodeSync(JobFailure)({ _tag: tag, message: summary(error) });
}
