import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function NoteShell({ children }: { readonly children: ReactNode }) {
	const pending = useRouterState({ select: (state) => state.isLoading });
	return (
		<main>
			<Link to="/">Home</Link>
			<Link to="/note">Note</Link>
			<output data-pending>{String(pending)}</output>
			{children}
		</main>
	);
}
