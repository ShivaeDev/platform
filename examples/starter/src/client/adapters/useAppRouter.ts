import { RegistryContext } from "@effect/atom-react";
import type { RouterHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useContext, useRef, useState } from "react";
import { appRouter } from "#client/appRouter.tsx";
import type { AppSession, AuthActions } from "#client/auth.ts";
import type { AppConnection } from "#client/Module.ts";

export interface Routing {
	readonly auth: AuthActions;
	readonly client: AppConnection;
	readonly history: RouterHistory | undefined;
	readonly recheck: () => void;
	readonly session?: AppSession | null | undefined;
}

export function useAppRouter({ client, auth, history, session, recheck }: Routing) {
	const registry = useContext(RegistryContext);
	const currentRef = useRef(session);
	currentRef.current = session;
	const [router] = useState(() =>
		Effect.runSync(
			appRouter(client, auth, history, () => currentRef.current, recheck).pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)),
		),
	);
	return router;
}
