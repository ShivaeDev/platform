import { Option } from "effect";
import { useBrowserErrors } from "@shivaedev/react/client/adapters/useBrowserErrors.ts";
import { useQuery } from "@shivaedev/react/client/resultState.ts";
import type { Auth } from "#client/adapters/auth.ts";
import { SessionApp } from "./SessionApp.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";

type SessionProps = Parameters<typeof SessionApp>[0];

export function App(props: { readonly auth: Auth } & Pick<SessionProps, "connect" | "history">) {
	useBrowserErrors();
	return (
		<>
			<ThemeToggle />
			<SessionContent {...props} />
		</>
	);
}

function SessionContent({ auth, connect, history }: { readonly auth: Auth } & Pick<SessionProps, "connect" | "history">) {
	const session = useQuery(auth.session.atom);
	const current = Option.getOrNull(session.data);
	if (Option.isNone(session.data) && session.pending) {
		return (
			<p className="p-8" role="status">
				Checking your session…
			</p>
		);
	}
	if (current === null && Option.isSome(session.cause)) {
		return (
			<main className="space-y-4 p-8">
				<p role="alert">Could not check your session.</p>
				<button onClick={session.refresh} type="button">
					Retry
				</button>
			</main>
		);
	}
	return (
		<SessionApp
			auth={auth.actions}
			connect={connect}
			history={history}
			recheck={session.refresh}
			session={current}
			sessionCheck={auth.session.refresh}
			userId={current?.user.id}
		/>
	);
}
