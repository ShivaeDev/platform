import { Schema } from "effect";

export const noteQueue = { name: "count-note-words", schema: Schema.Struct({ noteId: Schema.Number }) };
