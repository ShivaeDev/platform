import { RegistryContext } from "@effect/atom-react";
import type { RouterHistory } from "@tanstack/react-router";
import type { Effect, Layer } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useContext, useRef, useState } from "react";
import type { QueryStorageProvider } from "@shivaedev/contract/QueryStorage.ts";
import type { AppConnection, ClientApp } from "@shivaedev/react/client/app.ts";
import { SessionBoundary } from "@shivaedev/react/client/sessionBoundary.ts";
import { RouterProvider } from "@shivaedev/react/RouterProvider.ts";
import type { AppSession, AuthActions } from "#client/adapters/auth.ts";
import { appRouter } from "#client/appRouter.tsx";
import { clientModules } from "#client/modules.ts";
import { Notices } from "#client/Notices.tsx";

interface Routing {
	readonly auth: AuthActions;
	readonly connection: AppConnection;
	readonly history: RouterHistory | undefined;
	readonly recheck: () => void;
	readonly session?: AppSession | null | undefined;
}

function RoutedApp({ auth, connection, history, recheck, session }: Routing) {
	const registry = useContext(RegistryContext);
	const sessionRef = useRef(session);
	sessionRef.current = session;
	const [router] = useState(() => appRouter({ auth, connection, history, onAuthenticated: recheck, registry, session: () => sessionRef.current }));
	return (
		<Notices>
			<RouterProvider router={router} />
		</Notices>
	);
}

function SignedOutApp({ app, ...routing }: Omit<Routing, "connection" | "session"> & { readonly app: ClientApp }) {
	const registry = useContext(RegistryContext);
	const [connection] = useState(() => app.connect(undefined, registry));
	return <RoutedApp {...routing} connection={connection} />;
}

function identify(session: { readonly id: string }) {
	return session.id;
}

export function SessionApp({
	userId,
	session,
	recheck,
	sessionCheck,
	auth,
	app = clientModules,
	history,
	persist,
}: {
	readonly session?: AppSession | null | undefined;
	readonly userId: string | undefined;
	readonly recheck: () => void;
	readonly sessionCheck?: Effect.Effect<unknown, unknown, AtomRegistry.AtomRegistry> | undefined;
	readonly auth: AuthActions;
	readonly app?: ClientApp | undefined;
	readonly history?: RouterHistory | undefined;
	readonly persist?: Layer.Layer<QueryStorageProvider> | undefined;
}) {
	const location = history?.location ?? window.location;
	const redirectTo = location.pathname === "/sign-in" ? (new URLSearchParams(location.search).get("returnTo") ?? "/") : undefined;
	return (
		<SessionBoundary
			{...app}
			identify={identify}
			navigate={history === undefined ? undefined : (href) => history.replace(href)}
			persist={persist}
			recheck={sessionCheck ?? recheck}
			redirectTo={redirectTo}
			session={userId === undefined ? undefined : { id: userId }}
			signedOut={<SignedOutApp app={app} auth={auth} history={history} recheck={recheck} />}
			signOut={auth.signOut}
		>
			{(connection) => <RoutedApp auth={auth} connection={connection} history={history} recheck={recheck} session={session} />}
		</SessionBoundary>
	);
}
