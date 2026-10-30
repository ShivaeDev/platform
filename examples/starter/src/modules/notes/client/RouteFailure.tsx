import { type ErrorComponentProps, Link, Navigate, useLocation } from "@tanstack/react-router";
import { Predicate } from "effect";
import type { ReactElement } from "react";
import { signInSearch } from "@shivaedev/react/signInSearch.ts";

export function RouteFailure({ error, reset: handleClick }: ErrorComponentProps): ReactElement {
	const location = useLocation();
	const unauthorized = Predicate.isTagged(error, "Unauthorized");
	const search = signInSearch(location);
	if (unauthorized && search.returnTo === undefined) {
		return <Navigate replace search={search} to="/sign-in" />;
	}
	return (
		<main className="mx-auto max-w-md space-y-4 px-4 py-12">
			<p role="alert">{unauthorized ? "Sign in to view your notes." : "Could not load notes."}</p>
			{unauthorized ? (
				<Link className="underline" search={search} to="/sign-in">
					Sign in
				</Link>
			) : (
				<button onClick={handleClick} type="button">
					Retry
				</button>
			)}
		</main>
	);
}
