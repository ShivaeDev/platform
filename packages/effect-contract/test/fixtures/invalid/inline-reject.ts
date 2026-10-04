import { command, contract } from "#index.ts";
import { notes } from "#test/notes.ts";

const Inline = contract("inline", { commands: [command("touch", { invalidates: () => [notes.list] })] });

Inline.declaration.commands[0].reject.Anything();
