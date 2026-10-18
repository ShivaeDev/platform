import { createRootRouteWithContext, createRoute, createRouter, type RouterHistory, useRouterState } from "@tanstack/react-router";
import { Schema } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { ReactNode } from "react";
import { loadQuery } from "@shivaedev/effect-react/loadQuery.ts";
import type { AuthActions } from "./auth.ts";
import { LoginScreen } from "./LoginScreen.tsx";
import type { NotesClient } from "./makeNotes.ts";
import { NoteEdit } from "./NoteEdit.tsx";
import { NotesScreen } from "./NotesScreen.tsx";
import { RouteFailure } from "./RouteFailure.tsx";

export function appRouter(registry: AtomRegistry.AtomRegistry, client: NotesClient, auth: AuthActions, history?: RouterHistory) {
	const root = createRootRouteWithContext<{ readonly registry: AtomRegistry.AtomRegistry }>()();
	const notes = createRoute({
		component: () => (
			<NotesScreen
				client={client}
				loaded={notes.useLoaderData()}
				onSignedOut={() => void router.navigate({ to: "/sign-in" })}
				signOut={auth.signOut}
			/>
		),
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
			const loaded = note.useLoaderData();
			return <NoteEdit client={client} key={loaded.id} loaded={loaded} onDeleted={() => void router.navigate({ to: "/" })} />;
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
		defaultPendingMs: Number.POSITIVE_INFINITY,
		InnerWrap: RouteShell,
		...(history === undefined ? {} : { history }),
		routeTree: root.addChildren([notes, login, note]),
	});
	return router;
}

function RouteShell({ children }: { readonly children: ReactNode }) {
	const pending = useRouterState({ select: (state) => state.isLoading });
	return (
		<>
			{pending && <p role="status">Loading…</p>}
			{children}
		</>
	);
}
