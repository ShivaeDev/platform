import { Cause, Option } from "effect";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { authQuery } from "#client/authQuery.ts";
import { useQuery } from "#client/resultState.ts";

export interface AuthError {
	readonly code: "REFUSED";
	readonly status: number;
}
export type AuthReadQuery = ReturnType<ReturnType<typeof authQuery<string, string | null, AuthError>>>;

function failureText(cause: Cause.Cause<AuthError | AuthUnavailable>) {
	return Option.match(Cause.findErrorOption(cause), {
		onNone: () => "defect",
		onSome: (error) => (error instanceof AuthUnavailable ? `auth unavailable: ${error.message}` : `refused: ${error.code} (${error.status})`),
	});
}

export function AuthRead({ query }: { readonly query: AuthReadQuery }) {
	const state = useQuery(query);
	const shown = Option.match(state.cause, {
		onNone: () => Option.getOrElse(Option.flatMap(state.data, Option.fromNullishOr), () => (state.pending ? "Loading" : "Nothing")),
		onSome: failureText,
	});
	return <output>{shown}</output>;
}
