import { makeClient } from "@shivaedev/contract/bind.ts";
import type { ClientOptions } from "@shivaedev/contract/clientOptions.ts";
import { Notes } from "#modules/notes/notes.ts";

export function makeNotesClient(url: string, options: Omit<ClientOptions, "url"> = {}) {
	const { api, runtime } = makeClient(Notes, { url, ...options });
	return { api, runtime };
}
export type NotesClient = ReturnType<typeof makeNotesClient>;
