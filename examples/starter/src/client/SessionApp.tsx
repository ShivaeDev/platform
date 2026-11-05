import { type RouterHistory, RouterProvider } from "@tanstack/react-router";
import type { Effect } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { AppSession, AuthActions } from "#client/adapters/auth.ts";
import { SessionConnectionBoundary } from "#client/adapters/SessionConnectionBoundary.tsx";
import { useAnonymousConnection } from "#client/adapters/useAnonymousConnection.ts";
import { type Routing, useAppRouter } from "#client/adapters/useAppRouter.ts";
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
	sessionCheck,
	auth,
	connect: connection = defaultConnection,
	history,
}: {
	readonly session?: AppSession | null | undefined;
	readonly userId: string | undefined;
	readonly recheck: () => void;
	readonly sessionCheck?: Effect.Effect<unknown, unknown, AtomRegistry.AtomRegistry> | undefined;
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
			recheck={sessionCheck ?? recheck}
			redirectTo={redirectTo}
			session={userId === undefined ? undefined : { id: userId }}
			signedOut={<SignedOutApp auth={auth} connection={connection} history={history} recheck={recheck} />}
			signOut={auth.signOut}
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
