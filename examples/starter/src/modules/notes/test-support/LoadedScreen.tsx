import { useLoaderQuery } from "@shivaedev/react/client/useLoaderQuery.ts";
import type { ContractClient } from "@shivaedev/contract/makeClient.ts";
import type { Notes } from "#generated/modules/notes/Notes.ts";
import type { AuthActions } from "#client/adapters/auth.ts";
import { NotesScreen } from "#modules/notes/client/Screen.tsx";
import type { Note } from "#modules/notes/model.ts";

export function LoadedScreen({
	client,
	loaded,
	signOut,
}: {
	readonly client: ContractClient<typeof Notes>;
	readonly loaded: (typeof Note.Type)[];
	readonly signOut: AuthActions["signOut"] | undefined;
}) {
	const query = useLoaderQuery(client.list.query(), loaded);
	return <NotesScreen client={client} query={query} {...(signOut === undefined ? {} : { signOut })} />;
}
