import { RegistryContext } from "@effect/atom-react";
import { type RouterHistory, RouterProvider } from "@tanstack/react-router";
import { useContext, useState } from "react";
import { SessionBoundary } from "@shivaedev/effect-react/client/sessionBoundary.ts";
import { appRouter } from "./appRouter.tsx";
import type { AuthActions } from "./auth.ts";
import type { NotesClient } from "./makeNotes.ts";

interface Session {
	readonly id: string;
}
interface Routing {
	readonly auth: AuthActions;
	readonly client: NotesClient;
	readonly history: RouterHistory | undefined;
}

function RoutedApp({ client, auth, history }: Routing) {
	const registry = useContext(RegistryContext);
	const [router] = useState(() => appRouter(registry, client, auth, history));
	return <RouterProvider router={router} />;
}

function identify(session: Session) {
	return session.id;
}

export function SessionApp({
	sessionId,
	recheck,
	auth,
	connect: connection,
	history,
}: {
	readonly sessionId: string;
	readonly recheck: () => void;
	readonly auth: AuthActions;
	readonly connect: (session: Session) => NotesClient;
	readonly history?: RouterHistory | undefined;
}) {
	return (
		<SessionBoundary connect={connection} identify={identify} recheck={recheck} session={{ id: sessionId }}>
			{(client) => <RoutedApp auth={auth} client={client} history={history} />}
		</SessionBoundary>
	);
}
