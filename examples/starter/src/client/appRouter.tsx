import { createRootRouteWithContext, createRoute, createRouter, type RouterHistory } from "@tanstack/react-router";
import { Schema } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { loadQuery } from "@shivaedev/effect-react/router.ts";
import { type AuthActions, authActions } from "./auth.ts";
import { LoginScreen } from "./LoginScreen.tsx";
import type { NotesClient } from "./makeNotes.ts";
import { NoteEdit } from "./NoteEdit.tsx";
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
	const note = createRoute({
		component: () => {
			const { noteId } = note.useParams();
			return <NoteEdit client={client} key={noteId} noteId={noteId} onDeleted={() => void router.navigate({ to: "/" })} />;
		},
		errorComponent: RouteFailure,
		getParentRoute: () => root,
		loader: (context) => loadQuery(context.context.registry, client.api.get.query({ id: context.params.noteId }), context),
		params: {
			parse: ({ noteId }) => ({ noteId: Schema.decodeUnknownSync(Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThan(0)))(noteId) }),
			stringify: ({ noteId }: { readonly noteId: number }) => ({ noteId: String(noteId) }),
		},
		path: "/notes/$noteId",
	});
	const router = createRouter({
		context: { registry },
		...(history === undefined ? {} : { history }),
		routeTree: root.addChildren([notes, login, note]),
	});
	return router;
}
