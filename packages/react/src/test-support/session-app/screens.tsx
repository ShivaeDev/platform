import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { useSessionRecheck } from "#client/sessionBoundary.ts";

export function SignIn(): ReactElement {
	const recheck = useSessionRecheck();
	function handleSignIn() {
		recheck();
	}
	return (
		<main>
			<h1>Sign in</h1>
			<button onClick={handleSignIn} type="button">
				Sign in
			</button>
		</main>
	);
}

export function Home(): ReactElement {
	return (
		<main>
			<h1>Home</h1>
			<Link to="/notes">Notes</Link>
		</main>
	);
}
