import { makeClient } from "#makeClient.ts";
import { Notes } from "#test/notes.ts";

export const api = makeClient({ notes: Notes }, { url: "http://127.0.0.1/rpc" }).api.notes;
