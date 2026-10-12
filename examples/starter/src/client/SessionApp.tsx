import { RegistryContext } from "@effect/atom-react";
import { type RouterHistory, RouterProvider } from "@tanstack/react-router";
import { useContext, useState } from "react";
import { SessionBoundary } from "@shivaedev/effect-react/session-boundary.ts";
import { appRouter } from "./appRouter.tsx";
import { type AuthActions, authActions } from "./auth.ts";
import { makeNotesClient, type NotesClient } from "./makeNotes.ts";

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
	const [router] = useState(() => appRouter(registry, client, history, auth));
	return <RouterProvider router={router} />;
}

function connect() {
	return makeNotesClient(new URL("/rpc", window.location.href).href);
}
function identify(session: Session) {
	return session.id;
}

export function SessionApp({
	sessionId,
	recheck,
	auth = authActions,
	connect: connection = connect,
	history,
}: {
	readonly sessionId: string;
	readonly recheck: () => void;
	readonly auth?: AuthActions;
	readonly connect?: (session: Session) => NotesClient;
	readonly history?: RouterHistory;
}) {
	return (
		<SessionBoundary connect={connection} identify={identify} recheck={recheck} session={{ id: sessionId }}>
			{(client) => <RoutedApp auth={auth} client={client} history={history} />}
		</SessionBoundary>
	);
}
