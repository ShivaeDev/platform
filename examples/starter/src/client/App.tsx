import { Option } from "effect";
import { useBrowserErrors } from "@shivaedev/react/client/adapters/useBrowserErrors.ts";
import { useQuery } from "@shivaedev/react/client/resultState.ts";
import { SessionApp, type SessionAppProps } from "@shivaedev/react/client/SessionApp.ts";
import type { Auth } from "#client/adapters/auth.ts";
import { clientModules } from "#client/modules.ts";
import { routing } from "#client/routing.tsx";
import { ThemeToggle } from "#client/ThemeToggle.tsx";

type AppProps = { readonly auth: Auth } & Partial<Pick<SessionAppProps, "app">> & Pick<SessionAppProps, "history" | "persist">;

export function App(props: AppProps) {
	useBrowserErrors();
	return (
		<>
			<ThemeToggle />
			<SessionContent {...props} />
		</>
	);
}

function SessionContent({ app = clientModules, auth, history, persist }: AppProps) {
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
			{...routing}
			app={app}
			auth={auth.actions}
			history={history}
			persist={persist}
			recheck={auth.session.refresh}
			session={current}
		/>
	);
}
