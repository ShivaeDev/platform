import { RegistryContext } from "@effect/atom-react";
import { type RouterHistory, RouterProvider } from "@tanstack/react-router";
import { useContext, useRef, useState } from "react";
import { PermissionBoundary } from "@shivaedev/react/client/permissionBoundary.ts";
import { SessionBoundary } from "@shivaedev/react/client/sessionBoundary.ts";
import type { PermissionSession } from "@shivaedev/react/permissions.ts";
import { appRouter } from "./appRouter.tsx";
import type { AuthActions } from "./auth.ts";
import type { AppConnection } from "./Module.ts";
import { clientModules } from "./modules.ts";

interface Session {
	readonly id: string;
}
interface Routing {
	readonly auth: AuthActions;
	readonly client: AppConnection;
	readonly history: RouterHistory | undefined;
	readonly session?: PermissionSession | null | undefined;
}

function RoutedApp({ client, auth, history, session }: Routing) {
	const registry = useContext(RegistryContext);
	const currentRef = useRef(session);
	currentRef.current = session;
	const [router] = useState(() => appRouter(registry, client, auth, history, () => currentRef.current));
	return (
		<PermissionBoundary
			fallback={
				<main className="space-y-4 p-8">
					<h1 className="font-semibold text-3xl">Permission denied</h1>
					<p>You do not have access to this page.</p>
				</main>
			}
			session={session}
		>
			<RouterProvider router={router} />
		</PermissionBoundary>
	);
}

function identify(session: Session) {
	return session.id;
}

export function SessionApp({
	sessionId,
	session,
	recheck,
	auth,
	connect: connection = clientModules,
	history,
}: {
	readonly session?: PermissionSession | null | undefined;
	readonly sessionId: string;
	readonly recheck: () => void;
	readonly auth: AuthActions;
	readonly connect?: ((session: Session) => AppConnection) | undefined;
	readonly history?: RouterHistory | undefined;
}) {
	return (
		<SessionBoundary connect={connection} identify={identify} recheck={recheck} session={{ id: sessionId }}>
			{(client) => <RoutedApp auth={auth} client={client} history={history} session={session} />}
		</SessionBoundary>
	);
}
