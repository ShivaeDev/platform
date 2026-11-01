import { notFound } from "@tanstack/react-router";
import { Predicate } from "effect";
import { isForbidden, isNotFound, isUnauthorized } from "@shivaedev/errors/taxonomy.ts";
import type { SignInLocation } from "#signInSearch.ts";

export type QueryRouteRedirect = Response & { readonly options: object };

export interface QueryRouteRedirects {
	readonly refused?: () => QueryRouteRedirect;
	readonly signedOut?: (location: SignInLocation) => QueryRouteRedirect;
}

export function queryRouteFailure(error: unknown, location: SignInLocation, redirects: QueryRouteRedirects | undefined): unknown {
	if (isUnauthorized(error) && redirects?.signedOut) {
		return redirects.signedOut(location);
	}
	if ((isForbidden(error) || Predicate.isTagged(error, "QueryReadDenied")) && redirects?.refused) {
		return redirects.refused();
	}
	return isNotFound(error) || Predicate.isTagged(error, "QueryReadDenied") ? notFound({ data: error }) : error;
}
