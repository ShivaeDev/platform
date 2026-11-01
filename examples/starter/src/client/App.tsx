import { Result, Schema } from "effect";
import { useCallback } from "react";
import { useBrowserErrors } from "@shivaedev/react/client/adapters/useBrowserErrors.ts";
import { type Auth, SessionAccess } from "./auth.ts";
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
	const session = auth.client.useSession();
	const recheck = useCallback(() => {
		void session.refetch();
	}, [session.refetch]);
	if (session.isPending) {
		return (
			<p className="p-8" role="status">
				Checking your session…
			</p>
		);
	}
	const decoded = session.data === null ? Result.succeed(null) : Schema.decodeUnknownResult(SessionAccess)(session.data);
	if (session.error !== null || Result.isFailure(decoded)) {
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
			recheck={recheck}
			session={decoded.success}
			userId={decoded.success?.user.id}
		/>
	);
}
