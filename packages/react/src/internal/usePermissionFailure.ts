import { Cause, Option, Predicate } from "effect";
import { useContext } from "react";
import { PermissionContext } from "./PermissionContext.ts";

export function usePermissionFailure<E>(cause: Option.Option<Cause.Cause<E>>): void {
	const context = useContext(PermissionContext);
	if (context !== undefined) {
		const failure = Option.flatMap(cause, Cause.findErrorOption);
		if (Option.isSome(failure) && Predicate.isTagged(failure.value, "Forbidden")) {
			throw failure.value;
		}
	}
}
