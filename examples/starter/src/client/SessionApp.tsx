import { RegistryContext } from "@effect/atom-react";
import { type RouterHistory, RouterProvider } from "@tanstack/react-router";
import { useContext, useState } from "react";
import { SessionBoundary } from "@shivaedev/effect-react/client/sessionBoundary.ts";
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
	connect: connection = clientModules,
	history,
}: {
	readonly sessionId: string;
	readonly recheck: () => void;
	readonly auth: AuthActions;
	readonly connect?: ((session: Session) => AppConnection) | undefined;
	readonly history?: RouterHistory | undefined;
}) {
	return (
		<SessionBoundary connect={connection} identify={identify} recheck={recheck} session={{ id: sessionId }}>
			{(client) => <RoutedApp auth={auth} client={client} history={history} />}
		</SessionBoundary>
	);
}
