import { Rename } from "#test/notes.ts";

Rename.reject.Invalid({ field: "body", message: "Only the title is checked" });
