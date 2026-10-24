import { createRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { loadQuery } from "@shivaedev/effect-react/loadQuery.ts";
import type { ClientModule, RouteContext } from "#client/Module.ts";
import { NoteEdit } from "./Edit.tsx";
import { makeNotesClient, type NotesClient } from "./make.ts";
import { RouteFailure } from "./RouteFailure.tsx";
import { NotesScreen } from "./Screen.tsx";

export function notesRegistration(client: NotesClient = makeNotesClient(new URL("/rpc", window.location.href).href)): ClientModule {
	return { api: client.api, routes: (context) => routes(client, context) };
}

function routes(client: NotesClient, { root, registry, auth, navigate }: RouteContext) {
	const notes = createRoute({
		component: () => <NotesScreen client={client} loaded={notes.useLoaderData()} onSignedOut={() => navigate("/sign-in")} signOut={auth.signOut} />,
		errorComponent: RouteFailure,
		getParentRoute: () => root,
		loader: (context) => loadQuery(registry, client.api.list.query(), context),
		path: "/",
	});
	const note = createRoute({
		component: () => {
			const loaded = note.useLoaderData();
			return <NoteEdit client={client} key={loaded.id} loaded={loaded} onDeleted={() => navigate("/")} />;
		},
		errorComponent: RouteFailure,
		getParentRoute: () => root,
		loader: (context) => loadQuery(registry, client.api.get.query({ id: context.params.noteId }), context),
		params: {
			parse: ({ noteId }) => ({ noteId: Schema.decodeUnknownSync(Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThan(0)))(noteId) }),
			stringify: ({ noteId }: { readonly noteId: number }) => ({ noteId: String(noteId) }),
		},
		path: "/notes/$noteId",
	});
	return [notes, note];
}
