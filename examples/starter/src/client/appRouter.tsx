import { createRootRouteWithContext, createRoute, createRouter, type RouterHistory } from "@tanstack/react-router";
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { loadQuery } from "@shivaedev/effect-react/router.ts";
import { type AuthActions, authActions } from "./auth.ts";
import { LoginScreen } from "./LoginScreen.tsx";
import type { NotesClient } from "./makeNotes.ts";
import { NotesScreen } from "./NotesScreen.tsx";
import { RouteFailure } from "./RouteFailure.tsx";

export function appRouter(registry: AtomRegistry.AtomRegistry, client: NotesClient, history?: RouterHistory, auth: AuthActions = authActions) {
	const root = createRootRouteWithContext<{ readonly registry: AtomRegistry.AtomRegistry }>()();
	const notes = createRoute({
		component: () => <NotesScreen client={client} onSignOut={() => auth.signOut()} />,
		errorComponent: RouteFailure,
		getParentRoute: () => root,
		loader: (context) => loadQuery(context.context.registry, client.api.list.query(), context),
		path: "/",
	});
	const login = createRoute({
		component: () => <LoginScreen auth={auth} onAuthenticated={() => void router.navigate({ to: "/" })} />,
		getParentRoute: () => root,
		path: "/sign-in",
	});
	const router = createRouter({ context: { registry }, ...(history === undefined ? {} : { history }), routeTree: root.addChildren([notes, login]) });
	return router;
}
