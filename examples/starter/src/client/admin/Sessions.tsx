import { SessionsView } from "@shivaedev/admin/client/SessionsView.ts";
import { useSignOut } from "@shivaedev/react/client/useSignOut.ts";
import type { AuthActions } from "#client/auth.ts";
import type { FoundationClient } from "./foundation.ts";

export function AdminSessions({
	auth,
	client,
	currentSessionId,
}: {
	readonly auth: AuthActions;
	readonly client: FoundationClient;
	readonly currentSessionId: string | undefined;
}) {
	const signOut = useSignOut(auth.signOut, { signIn: "/sign-in" });
	return (
		<SessionsView
			currentSessionId={currentSessionId}
			list={client.sessions.list.query}
			onCurrentSessionRevoked={signOut.dispatch}
			revoke={client.sessions.revoke.run}
			runtime={client.runtime}
		/>
	);
}
