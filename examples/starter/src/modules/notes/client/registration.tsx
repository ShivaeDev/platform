import { createRoute } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { ReactElement } from "react";
import { type MadeClient, makeClient } from "@shivaedev/contract/makeClient.ts";
import { queryRoute } from "@shivaedev/react/client/adapters/queryRoute.ts";
import type { RouteContext } from "#client/Module.ts";
import { Notes } from "#generated/modules/notes/Notes.ts";
import { Admin, StatisticsPage } from "#modules/notes/admin/pages.ts";
import { adminRegistration } from "#modules/notes/client/admin/registration.tsx";
import { NoteEdit } from "#modules/notes/client/Edit.tsx";
import { NotFound } from "#modules/notes/client/NotFound.tsx";
import { RouteFailure } from "#modules/notes/client/RouteFailure.tsx";
import { NotesScreen } from "#modules/notes/client/Screen.tsx";

const notesContracts = { notes: Notes, statistics: StatisticsPage.contract };

export function notesRegistration(client?: Pick<MadeClient<typeof notesContracts>, "api">) {
	return Effect.map(AtomRegistry.AtomRegistry, (registry) => notesModule(client ?? makeClient(notesContracts, { registry })));
}

function notesModule({ api }: Pick<MadeClient<typeof notesContracts>, "api">) {
	const { notes: client, statistics } = api;
	return {
		admin: Admin,
		api,
		routes: (routeContext: RouteContext) => {
			const { getParentRoute } = routeContext;
			const parent = createRoute({ getParentRoute, id: "notes", staticData: { signedIn: true } });
			const list = queryRoute(() => client.list.query());
			const notes = createRoute({
				component: (): ReactElement => {
					const { auth } = notes.useRouteContext();
					return <NotesScreen client={client} query={list.useQuery()} signOut={auth.signOut} />;
				},
				errorComponent: RouteFailure,
				getParentRoute: () => parent,
				...list,
				path: "/",
			});
			const noteQuery = queryRoute(({ params }: { params: { noteId: number } }) => client.get.query({ id: params.noteId }));
			const note = createRoute({
				component: (): ReactElement => {
					const { navigate } = note.useRouteContext();
					const loaded = noteQuery.useLoaded();
					return <NoteEdit client={client} key={loaded.loaded.id} note={loaded} onDeleted={() => navigate("/")} />;
				},
				errorComponent: RouteFailure,
				getParentRoute: () => parent,
				...noteQuery,
				notFoundComponent: NotFound,
				params: {
					parse: ({ noteId }) => ({
						noteId: Schema.decodeUnknownSync(Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThan(0)))(noteId),
					}),
					stringify: ({ noteId }: { readonly noteId: number }) => ({ noteId: String(noteId) }),
				},
				path: "/notes/$noteId",
			});
			return [parent.addChildren([notes, note]), ...adminRegistration(statistics).routes(routeContext)];
		},
		warm: [client.list.query()],
	};
}
