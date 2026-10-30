import { createRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import type { ReactElement } from "react";
import { queryRoute } from "@shivaedev/react/queryRoute.ts";
import type { ClientModule, RouteContext } from "#client/Module.ts";
import { Admin } from "#modules/notes/admin.ts";
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
): ClientModule<ReturnType<typeof routes>[number] | ReturnType<typeof adminRoutes>[number]> {
	return {
		admin: Admin,
		api: client.api,
		bindings: [client.api, admin.statistics],
		routes: (context) => [
			...routes(client, context),
			...adminRoutes(admin, { adminPages: context.adminPages, getParentRoute: () => context.root, session: context.session }),
		],
	};
}

function routes(client: NotesClient, { root, auth, navigate }: RouteContext) {
	const notes = createRoute({
		component: (): ReactElement => <NotesScreen client={client} loaded={notes.useLoaderData()} signOut={auth.signOut} />,
		errorComponent: RouteFailure,
		getParentRoute: () => root,
		...queryRoute(() => client.api.list.query()),
		path: "/",
	});
	const note = createRoute({
		component: (): ReactElement => {
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
