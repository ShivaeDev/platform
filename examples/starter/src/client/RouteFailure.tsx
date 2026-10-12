import { type ErrorComponentProps, Link } from "@tanstack/react-router";
import { Predicate } from "effect";

export function RouteFailure({ error, reset: handleClick }: ErrorComponentProps) {
	const unauthorized = Predicate.isTagged(error, "Unauthorized");
	return (
		<main className="mx-auto max-w-md space-y-4 px-4 py-12">
			<p role="alert">{unauthorized ? "Sign in to view your notes." : "Could not load notes."}</p>
			{unauthorized ? (
				<Link className="underline" to="/sign-in">
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
