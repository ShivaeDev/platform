import type { Effect } from "effect";
import { useState } from "react";
import { SessionsView } from "#client/adapters/SessionsView.ts";
import type { DateDisplay } from "#client/adapters/timestampText.ts";
import type { sessionsHost } from "#test/sessionsHost.ts";

export function SessionsScreenApp({
	dates,
	engine,
}: {
	readonly dates: DateDisplay;
	readonly engine: Effect.Success<ReturnType<typeof sessionsHost>>;
}) {
	const [signedOut, signOut] = useState(false);
	return signedOut ? (
		<p>Signed out</p>
	) : (
		<SessionsView
			{...dates}
			currentSessionId={engine.viewerId()}
			list={engine.api.list.query}
			onCurrentSessionRevoked={() => signOut(true)}
			revoke={engine.api.revoke.run}
			runtime={engine.runtime}
		/>
	);
}
