import type { Effect } from "effect";
import { useState } from "react";
import { SessionsView } from "#client/SessionsView.ts";
import type { sessionsHost } from "./sessionsHost.ts";

export function SessionsScreenApp({ engine }: { readonly engine: Effect.Success<ReturnType<typeof sessionsHost>> }) {
	const [signedOut, signOut] = useState(false);
	return signedOut ? (
		<p>Signed out</p>
	) : (
		<SessionsView
			currentSessionId={engine.viewerId()}
			list={engine.api.list.query}
			onCurrentSessionRevoked={() => signOut(true)}
			revoke={engine.api.revoke.run}
			runtime={engine.runtime}
		/>
	);
}
