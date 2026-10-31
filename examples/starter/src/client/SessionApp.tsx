import { RegistryContext } from "@effect/atom-react";
import { type RouterHistory, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useContext, useRef, useState } from "react";
import { PermissionBoundary } from "@shivaedev/react/client/permissionBoundary.ts";
import { SessionBoundary } from "@shivaedev/react/client/sessionBoundary.ts";
import { appRouter } from "./appRouter.tsx";
import type { AppSession, AuthActions } from "./auth.ts";
import type { AppConnection } from "./Module.ts";
import { clientModules } from "./modules.ts";

interface Session {
	readonly id: string;
}
interface Routing {
	readonly auth: AuthActions;
	readonly client: AppConnection;
	readonly history: RouterHistory | undefined;
	readonly recheck: () => void;
	readonly session?: AppSession | null | undefined;
}

function RoutedApp({ client, auth, history, session, recheck }: Routing) {
	const registry = useContext(RegistryContext);
	const currentRef = useRef(session);
	currentRef.current = session;
	const [router] = useState(() =>
		Effect.runSync(
			appRouter(client, auth, history, () => currentRef.current, recheck).pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)),
		),
	);
	return (
		<PermissionBoundary
			fallback={
				<main className="space-y-4 p-8">
					<h1 className="text-3xl font-semibold">Permission denied</h1>
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
	userId,
	session,
	recheck,
	auth,
	connect: connection = clientModules,
	history,
}: {
	readonly session?: AppSession | null | undefined;
	readonly userId: string | undefined;
	readonly recheck: () => void;
	readonly auth: AuthActions;
	readonly connect?: ((session: Session) => AppConnection) | undefined;
	readonly history?: RouterHistory | undefined;
}) {
	const location = history?.location ?? window.location;
	const redirectTo = location.pathname === "/sign-in" ? (new URLSearchParams(location.search).get("returnTo") ?? "/") : undefined;
	return (
		<SessionBoundary
			connect={connection}
			identify={identify}
			navigate={history === undefined ? undefined : (href) => history.replace(href)}
			recheck={recheck}
			redirectTo={redirectTo}
			session={userId === undefined ? undefined : { id: userId }}
			signedOut={<SignedOutApp auth={auth} connection={connection} history={history} recheck={recheck} />}
		>
			{(client) => <RoutedApp auth={auth} client={client} history={history} recheck={recheck} session={session} />}
		</SessionBoundary>
	);
}

function SignedOutApp({
	connection,
	...routing
}: Omit<Routing, "client" | "session"> & {
	readonly connection: (session: Session) => AppConnection;
}) {
	const [client] = useState(() => connection({ id: "anonymous" }));
	return <RoutedApp {...routing} client={client} />;
}
