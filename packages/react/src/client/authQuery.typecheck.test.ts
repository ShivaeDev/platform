import type { Cause, Option } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import type { AuthActionUnavailable } from "./authAction.ts";
import { authQuery } from "./authQuery.ts";
import { useQuery } from "./resultState.ts";

const consent = authQuery((id: string, _signal) =>
	Promise.resolve(
		id === "allowed"
			? { data: { id }, error: null }
			: { data: null, error: { code: "REFUSED" as const, status: HttpStatus.fromLiteral("Forbidden") } },
	),
);
export function useConsent() {
	const query = useQuery(consent("allowed"));
	const cause: Option.Option<Cause.Cause<{ readonly code: "REFUSED"; readonly status: number } | AuthActionUnavailable>> = query.cause;
	// @ts-expect-error Auth query inputs retain their declared type.
	consent(123);
	return cause;
}
