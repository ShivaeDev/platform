import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { makeClient } from "@shivaedev/contract/bind.ts";
import type { Activity } from "@shivaedev/contract/clientActivity.ts";
import type { ClientOptions } from "@shivaedev/contract/clientOptions.ts";
import { Notes } from "#generated/modules/notes/Notes.ts";

export function makeNotesClient(url: string, options: Omit<ClientOptions, "url"> & { readonly registry?: AtomRegistry.AtomRegistry } = {}) {
	return makeClient(Notes, { url, ...options });
}
export type NotesClient = Pick<ReturnType<typeof makeNotesClient>, "api" | "runtime" | typeof Activity>;
