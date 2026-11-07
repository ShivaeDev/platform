import { createRoute } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { ReactElement } from "react";
import { queryRoute } from "@shivaedev/react/adapters/queryRoute.ts";
import type { RouteContext } from "#client/Module.ts";
import { Admin } from "#modules/notes/admin/pages.ts";
import { type AdminClient, makeAdminClient } from "#modules/notes/client/admin/make.ts";
import { adminRegistration } from "#modules/notes/client/admin/registration.tsx";
import { NoteEdit } from "#modules/notes/client/Edit.tsx";
import { makeNotesClient, type NotesClient } from "#modules/notes/client/make.ts";
import { NotFound } from "#modules/notes/client/NotFound.tsx";
import { RouteFailure } from "#modules/notes/client/RouteFailure.tsx";
import { NotesScreen } from "#modules/notes/client/Screen.tsx";

export function notesRegistration(client?: NotesClient, admin?: AdminClient) {
	return Effect.map(AtomRegistry.AtomRegistry, (registry) =>
		notesModule(
			client ?? makeNotesClient(new URL("/rpc", window.location.href).href, { registry }),
			admin ?? makeAdminClient(new URL("/rpc", window.location.href).href, { registry }),
		),
	);
}

function notesModule(client: NotesClient, admin: AdminClient) {
	return {
		admin: Admin,
		api: client.api,
		bindings: [client.api, admin.statistics],
		routes: (routeContext: RouteContext) => {
			const { getParentRoute } = routeContext;
			const parent = createRoute({ context: () => ({ client }), getParentRoute, id: "notes", staticData: { signedIn: true } });
			const notes = createRoute({
				component: (): ReactElement => {
					const { client: routeClient, auth } = notes.useRouteContext();
					return <NotesScreen client={routeClient} loaded={notes.useLoaderData()} signOut={auth.signOut} />;
				},
				errorComponent: RouteFailure,
				getParentRoute: () => parent,
				...queryRoute(({ context }: { context: typeof parent.types.allContext }) => context.client.api.list.query()),
				path: "/",
			});
			const note = createRoute({
				component: (): ReactElement => {
					const { client: routeClient, navigate } = note.useRouteContext();
					const loaded = note.useLoaderData();
					return <NoteEdit client={routeClient} key={loaded.id} loaded={loaded} onDeleted={() => navigate("/")} />;
				},
				errorComponent: RouteFailure,
				getParentRoute: () => parent,
				...queryRoute(({ context, params }: { context: typeof parent.types.allContext; params: { noteId: number } }) =>
					context.client.api.get.query({ id: params.noteId }),
				),
				notFoundComponent: NotFound,
				params: {
					parse: ({ noteId }) => ({
						noteId: Schema.decodeUnknownSync(Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThan(0)))(noteId),
					}),
					stringify: ({ noteId }: { readonly noteId: number }) => ({ noteId: String(noteId) }),
				},
				path: "/notes/$noteId",
			});
			return [parent.addChildren([notes, note]), ...adminRegistration(admin).routes(routeContext)];
		},
	};
}
