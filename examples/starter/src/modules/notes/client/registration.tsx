import { createRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { queryRoute } from "@shivaedev/effect-react/queryRoute.ts";
import type { ClientModule, RouteContext } from "#client/Module.ts";
import { type AdminClient, makeAdminClient } from "./admin.ts";
import { adminRoutes } from "./adminRoutes.tsx";
import { NoteEdit } from "./Edit.tsx";
import { makeNotesClient, type NotesClient } from "./make.ts";
import { NotFound } from "./NotFound.tsx";
import { RouteFailure } from "./RouteFailure.tsx";
import { NotesScreen } from "./Screen.tsx";

export function notesRegistration(
	client: NotesClient = makeNotesClient(new URL("/rpc", window.location.href).href),
	admin: AdminClient = makeAdminClient(new URL("/rpc", window.location.href).href),
): ClientModule {
	return {
		api: client.api,
		bindings: [client.api, admin.jobs, admin.statistics],
		routes: (context) => [...routes(client, context), ...adminRoutes(admin, context)],
	};
}

function routes(client: NotesClient, { root, auth, navigate }: RouteContext) {
	const notes = createRoute({
		component: () => <NotesScreen client={client} loaded={notes.useLoaderData()} onSignedOut={() => navigate("/sign-in")} signOut={auth.signOut} />,
		errorComponent: RouteFailure,
		getParentRoute: () => root,
		...queryRoute(() => client.api.list.query()),
		path: "/",
	});
	const note = createRoute({
		component: () => {
			const loaded = note.useLoaderData();
			return <NoteEdit client={client} key={loaded.id} loaded={loaded} onDeleted={() => navigate("/")} />;
		},
		errorComponent: RouteFailure,
		getParentRoute: () => root,
		...queryRoute(({ params }: { params: { noteId: number } }) => client.api.get.query({ id: params.noteId })),
		notFoundComponent: NotFound,
		params: {
			parse: ({ noteId }) => ({ noteId: Schema.decodeUnknownSync(Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThan(0)))(noteId) }),
			stringify: ({ noteId }: { readonly noteId: number }) => ({ noteId: String(noteId) }),
		},
		path: "/notes/$noteId",
	});
	return [notes, note];
}
