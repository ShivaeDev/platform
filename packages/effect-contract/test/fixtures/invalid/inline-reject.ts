import { command, contract } from "../../../src/index.ts";
import { notes } from "../../notes.ts";

const Inline = contract("inline", { commands: [command("touch", { invalidates: () => [notes.list] })] });

Inline.declaration.commands[0].reject.Anything();
