import { useLoaderQuery } from "@shivaedev/react/client/useLoaderQuery.ts";
import type { AuthActions } from "#client/adapters/auth.ts";
import type { NotesClient } from "#modules/notes/client/make.ts";
import { NotesScreen } from "#modules/notes/client/Screen.tsx";
import type { Note } from "#modules/notes/model.ts";

export function LoadedScreen({
	client,
	loaded,
	signOut,
}: {
	readonly client: NotesClient;
	readonly loaded: (typeof Note.Type)[];
	readonly signOut: AuthActions["signOut"] | undefined;
}) {
	const query = useLoaderQuery(client.api.list.query(), loaded);
	return <NotesScreen client={client} query={query} {...(signOut === undefined ? {} : { signOut })} />;
}
