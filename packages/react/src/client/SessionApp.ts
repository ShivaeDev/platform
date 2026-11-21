import { RegistryContext } from "@effect/atom-react";
import type { RouterHistory } from "@tanstack/react-router";
import type { Layer } from "effect";
import { createElement, type ReactNode, useContext, useRef, useState } from "react";
import type { QueryStorageProvider } from "@shivaedev/contract/QueryStorage.ts";
import type { AppConnection, ClientApp } from "#client/app.ts";
import type { RegisteredAuth, RegisteredSession } from "#client/module.ts";
import { SessionBoundary, type SessionBoundaryProps } from "#client/sessionBoundary.ts";
import { type SessionRouting, SIGN_IN, sessionRouter } from "#client/sessionRouter.ts";
import { RouterProvider } from "#RouterProvider.ts";

export interface SessionAppProps extends SessionRouting {
	readonly app: ClientApp;
	readonly auth: RegisteredAuth;
	readonly history?: RouterHistory | undefined;
	readonly persist?: Layer.Layer<QueryStorageProvider> | undefined;
	readonly recheck: SessionBoundaryProps<unknown, unknown>["recheck"];
	readonly session: RegisteredSession | null | undefined;
}

interface RoutedProps extends SessionRouting {
	readonly auth: RegisteredAuth;
	readonly connection: AppConnection;
	readonly history: RouterHistory | undefined;
	readonly session: RegisteredSession | null | undefined;
}

function RoutedApp({ connection, session, ...routing }: RoutedProps): ReactNode {
	const registry = useContext(RegistryContext);
	const sessionRef = useRef(session);
	sessionRef.current = session;
	const [router] = useState(() => sessionRouter({ ...routing, connection, registry, session: () => sessionRef.current }));
	return createElement(RouterProvider, { router });
}

function SignedOutApp({ app, ...routing }: Omit<RoutedProps, "connection" | "session"> & { readonly app: ClientApp }): ReactNode {
	const registry = useContext(RegistryContext);
	const [connection] = useState(() => app.connect(undefined, registry));
	return createElement(RoutedApp, { ...routing, connection, session: null });
}

function identify(session: RegisteredSession): string {
	return session.user.id;
}

// A visitor who signed in at the sign-in route continues to the location sign-in was asked to return to.
function returnTarget(history: RouterHistory | undefined): string | undefined {
	const location = history?.location ?? window.location;
	return location.pathname === SIGN_IN ? (new URLSearchParams(location.search).get("returnTo") ?? "/") : undefined;
}

export function SessionApp({ app, history, persist, recheck, session, ...routing }: SessionAppProps): ReactNode {
	function children(connection: AppConnection): ReactNode {
		return createElement(RoutedApp, { ...routing, connection, history, session });
	}
	return createElement(SessionBoundary<RegisteredSession, AppConnection>, {
		children,
		connect: app.connect,
		identify,
		navigate: history === undefined ? undefined : (href) => history.replace(href),
		persist,
		recheck,
		redirectTo: returnTarget(history),
		session: session ?? undefined,
		signedOut: createElement(SignedOutApp, { ...routing, app, history }),
		signOut: routing.auth.signOut,
		warm: app.warm,
	});
}
