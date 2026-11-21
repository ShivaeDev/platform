import { SessionsView } from "@shivaedev/admin/client/SessionsView.ts";
import type { ContractClient } from "@shivaedev/contract/makeClient.ts";
import { useSignOut } from "@shivaedev/react/client/adapters/useSignOut.ts";
import type { foundation } from "#admin/foundation.ts";
import type { AuthActions } from "#client/adapters/auth.ts";

export function AdminSessions({
	auth,
	client,
	currentSessionId,
}: {
	readonly auth: AuthActions;
	readonly client: ContractClient<typeof foundation.SessionsPage.contract>;
	readonly currentSessionId: string | undefined;
}) {
	const signOut = useSignOut(auth.signOut, { signIn: "/sign-in" });
	return (
		<SessionsView
			currentSessionId={currentSessionId}
			list={client.list.query}
			onCurrentSessionRevoked={signOut.dispatch}
			revoke={client.revoke}
		/>
	);
}
