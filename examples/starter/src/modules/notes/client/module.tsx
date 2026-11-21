import { createRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import type { ReactElement } from "react";
import { queryRoute } from "@shivaedev/react/client/adapters/queryRoute.ts";
import { clientModule } from "@shivaedev/react/client/module.ts";
import { Notes } from "#generated/modules/notes/Notes.ts";
import { NoteEdit } from "#modules/notes/client/Edit.tsx";
import { NotFound } from "#modules/notes/client/NotFound.tsx";
import { RouteFailure } from "#modules/notes/client/RouteFailure.tsx";
import { NotesScreen } from "#modules/notes/client/Screen.tsx";

const NoteIdParam = Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThan(0));

export const notesModule = clientModule({ notes: Notes }, ({ notes }) => ({
	routes: (root) => {
		const parent = createRoute({ getParentRoute: () => root, id: "notes", staticData: { signedIn: true } });
		const list = queryRoute(() => notes.list.query());
		const index = createRoute({
			component: (): ReactElement => <NotesScreen client={notes} query={list.useQuery()} signOut={index.useRouteContext().auth.signOut} />,
			errorComponent: RouteFailure,
			getParentRoute: () => parent,
			...list,
			path: "/",
		});
		const noteQuery = queryRoute(({ params }: { params: { noteId: number } }) => notes.get.query({ id: params.noteId }));
		const note = createRoute({
			component: (): ReactElement => {
				const { navigate } = note.useRouteContext();
				const loaded = noteQuery.useLoaded();
				return <NoteEdit client={notes} key={loaded.loaded.id} note={loaded} onDeleted={() => navigate("/")} />;
			},
			errorComponent: RouteFailure,
			getParentRoute: () => parent,
			...noteQuery,
			notFoundComponent: NotFound,
			params: {
				parse: ({ noteId }) => ({ noteId: Schema.decodeUnknownSync(NoteIdParam)(noteId) }),
				stringify: ({ noteId }: { readonly noteId: number }) => ({ noteId: String(noteId) }),
			},
			path: "/notes/$noteId",
		});
		return [parent.addChildren([index, note])];
	},
	warm: [notes.list.query()],
}));
