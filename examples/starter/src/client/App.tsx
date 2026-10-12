import { authClient } from "./auth.ts";
import { SessionApp } from "./SessionApp.tsx";

export function App() {
	const session = authClient.useSession();
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
	return <SessionApp recheck={() => void session.refetch()} sessionId={session.data?.session.id ?? "anonymous"} />;
}
