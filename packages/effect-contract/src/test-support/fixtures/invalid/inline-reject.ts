import { contract } from "#contract.ts";
import { command } from "#operation.ts";
import { notes } from "#test/notes.ts";

const Inline = contract("inline", { commands: [command("touch", { invalidates: () => [notes.list] })] });

Inline.declaration.commands[0].reject.Anything();
