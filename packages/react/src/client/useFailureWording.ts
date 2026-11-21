import { Cause, Option, Predicate } from "effect";
import { type ReactNode, useContext } from "react";
import { isRequestRejection } from "@shivaedev/errors/taxonomy.ts";
import { FailureHostContext } from "#client/FailureHostContext.ts";
import { defaultFailureHost } from "#client/notices.ts";
import { unexpectedFailure } from "#client/unexpectedFailure.ts";

// A failure shown in place uses the words a notice would: the server's message for a shared rejection, the host's wording otherwise.
export function useFailureWording(): (cause: Cause.Cause<unknown>) => ReactNode {
	const host = useContext(FailureHostContext) ?? defaultFailureHost;
	return (cause) => {
		const error = Option.getOrUndefined(Cause.findErrorOption(cause));
		return isRequestRejection(error) && Predicate.isString(error.message) && error.message !== ""
			? error.message
			: host.word(unexpectedFailure(cause));
	};
}
