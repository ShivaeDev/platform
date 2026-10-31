import { makeClient } from "@shivaedev/contract/bind.ts";
import { Activity, clientActivity } from "@shivaedev/contract/clientActivity.ts";
import type { ClientOptions } from "@shivaedev/contract/clientOptions.ts";
import { Notes } from "#modules/notes/notes.ts";

export function makeNotesClient(url: string, options: Omit<ClientOptions, "url"> = {}) {
	const client = makeClient(Notes, { url, ...options });
	return { api: client.api, runtime: client.runtime, [Activity]: clientActivity(client) };
}
export type NotesClient = ReturnType<typeof makeNotesClient>;
