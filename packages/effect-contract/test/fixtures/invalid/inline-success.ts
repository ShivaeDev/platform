import { Effect } from "effect";
import { command, contract, query } from "#index.ts";
import { notes } from "#test/notes.ts";

const Inline = contract("inline", {
	commands: [command("touch", { invalidates: () => [notes.list] })],
	queries: [query("list", { reads: () => [notes.list] })],
});

Inline.of({
	"inline.list": () => Effect.void,
	"inline.touch": () => Effect.succeed(5),
});
