import { type RouterHistory, RouterProvider } from "@tanstack/react-router";
import { SessionConnectionBoundary } from "#client/adapters/SessionConnectionBoundary.tsx";
import { useAnonymousConnection } from "#client/adapters/useAnonymousConnection.ts";
import { type Routing, useAppRouter } from "#client/adapters/useAppRouter.ts";
import type { AppSession, AuthActions } from "./auth.ts";
import type { ClientConnection } from "./Module.ts";
import { clientModules } from "./modules.ts";

const defaultConnection: ClientConnection = (session) => clientModules(session);

interface Session {
	readonly id: string;
}
function RoutedApp(routing: Routing) {
	const router = useAppRouter(routing);
	return <RouterProvider router={router} />;
}

function identify(session: Session) {
	return session.id;
}

export function SessionApp({
	userId,
	session,
	recheck,
	auth,
	connect: connection = defaultConnection,
	history,
}: {
	readonly session?: AppSession | null | undefined;
	readonly userId: string | undefined;
	readonly recheck: () => void;
	readonly auth: AuthActions;
	readonly connect?: ClientConnection | undefined;
	readonly history?: RouterHistory | undefined;
}) {
	const location = history?.location ?? window.location;
	const redirectTo = location.pathname === "/sign-in" ? (new URLSearchParams(location.search).get("returnTo") ?? "/") : undefined;
	return (
		<SessionConnectionBoundary
			connect={connection}
			identify={identify}
			navigate={history === undefined ? undefined : (href) => history.replace(href)}
			recheck={recheck}
			redirectTo={redirectTo}
			session={userId === undefined ? undefined : { id: userId }}
			signedOut={<SignedOutApp auth={auth} connection={connection} history={history} recheck={recheck} />}
		>
			{(client) => <RoutedApp auth={auth} client={client} history={history} recheck={recheck} session={session} />}
		</SessionConnectionBoundary>
	);
}

function SignedOutApp({
	connection,
	...routing
}: Omit<Routing, "client" | "session"> & {
	readonly connection: ClientConnection;
}) {
	const client = useAnonymousConnection(connection);
	return <RoutedApp {...routing} client={client} />;
}
