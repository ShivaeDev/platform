import { Link } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement, ReactNode } from "react";
import type { ContractClient } from "@shivaedev/contract/makeClient.ts";
import { useQuery } from "#client/resultState.ts";
import { useSessionRecheck } from "#client/sessionBoundary.ts";
import type { Diary } from "#test/session-app/backend.ts";

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

export function DiaryView({ diary }: { readonly diary: ContractClient<typeof Diary> }): ReactElement {
	const entries = useQuery(diary.entries.query());
	const shown = Option.isSome(entries.cause) ? "Sign in to read" : Option.getOrElse(entries.data, () => "Loading");
	return (
		<main>
			<h1>Diary</h1>
			<output aria-label="Diary">{shown}</output>
		</main>
	);
}

export function Broken(): ReactElement {
	throw new Error("Broken screen");
}

export function Shell({ children }: { readonly children: ReactNode }): ReactElement {
	return <div data-shell="">{children}</div>;
}

export function NotFound(): ReactElement {
	return <h1>Page not found</h1>;
}
