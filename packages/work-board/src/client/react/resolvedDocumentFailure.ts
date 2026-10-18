import { Cause, Option, Predicate } from "effect";

export function resolvedDocumentFailure(cause: Cause.Cause<unknown>): boolean {
	const error = Option.getOrUndefined(Cause.findErrorOption(cause));
	return Predicate.isTagged(error, "NotFound") || Predicate.isTagged(error, "Conflict");
}
