import { redirect } from "@tanstack/react-router";
import type { QueryRouteRedirect } from "#adapters/queryRouteFailure.ts";
import { type SignInLocation, signInSearch } from "#signInSearch.ts";

export function signInRedirect(to: string): (location: SignInLocation) => QueryRouteRedirect {
	return (location) => redirect({ search: signInSearch(location), to });
}
