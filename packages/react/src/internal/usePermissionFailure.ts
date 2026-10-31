import { Cause, Option } from "effect";
import { useContext } from "react";
import { isForbidden } from "@shivaedev/errors/taxonomy.ts";
import { PermissionContext } from "./PermissionContext.ts";

export function usePermissionFailure<E>(cause: Option.Option<Cause.Cause<E>>): void {
	const context = useContext(PermissionContext);
	if (context !== undefined) {
		const failure = Option.flatMap(cause, Cause.findErrorOption);
		if (Option.isSome(failure) && isForbidden(failure.value)) {
			throw failure.value;
		}
	}
}
