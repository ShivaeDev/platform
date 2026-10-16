import type { Auth } from "./auth.ts";
import { SessionApp } from "./SessionApp.tsx";

type SessionProps = Parameters<typeof SessionApp>[0];

export function App({ auth, connect, history }: { readonly auth: Auth } & Pick<SessionProps, "connect" | "history">) {
	const session = auth.client.useSession();
	if (session.isPending) {
		return (
			<p className="p-8" role="status">
				Checking your session…
			</p>
		);
	}
	if (session.error !== null) {
		return (
			<main className="space-y-4 p-8">
				<p role="alert">Could not check your session.</p>
				<button onClick={() => void session.refetch()} type="button">
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
			recheck={() => void session.refetch()}
			sessionId={session.data?.session.id ?? "anonymous"}
		/>
	);
}
