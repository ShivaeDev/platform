import type { RouterHistory } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { useState } from "react";
import type { ClientApp } from "#client/app.ts";
import type { SessionUser } from "#client/module.ts";
import { SessionApp } from "#client/SessionApp.ts";
import { Home } from "#test/session-app/screens.tsx";

const auth = { signOut: Atom.make(AsyncResult.initial<unknown, unknown>()) };

// The auth owner answers the next session check with the session a sign-in created.
export function Host({
	app,
	history,
	initial,
	signedIn,
}: {
	readonly app: ClientApp;
	readonly history: RouterHistory;
	readonly initial: SessionUser | null;
	readonly signedIn: SessionUser;
}) {
	const [session, setSession] = useState(initial);
	return (
		<SessionApp
			app={app}
			auth={auth}
			forbidden={<h1>Refused</h1>}
			history={history}
			home={Home}
			recheck={() => setSession(signedIn)}
			session={session}
		/>
	);
}
