import type { RouterHistory } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { useState } from "react";
import type { ClientApp } from "#client/app.ts";
import type { SessionUser } from "#client/module.ts";
import { SessionApp } from "#client/SessionApp.ts";
import type { SessionRouting } from "#client/sessionRouter.ts";
import { Home, Shell } from "#test/session-app/screens.tsx";

const auth = { signOut: Atom.make(AsyncResult.initial<unknown, unknown>()) };

// The auth owner answers each session check with the session it finds, which a sign-in has just created or which is still none.
export function Host({
	answer,
	app,
	history,
	initial,
	countCheck,
	routing,
}: {
	readonly answer: SessionUser | null;
	readonly app: ClientApp;
	readonly history: RouterHistory;
	readonly initial: SessionUser | null;
	readonly countCheck: () => void;
	readonly routing: SessionRouting;
}) {
	const [session, setSession] = useState(initial);
	function handleCheck() {
		countCheck();
		setSession(answer);
	}
	return (
		<SessionApp
			{...routing}
			app={app}
			auth={auth}
			forbidden={<h1>Refused</h1>}
			history={history}
			home={Home}
			recheck={handleCheck}
			session={session}
			shell={Shell}
		/>
	);
}
