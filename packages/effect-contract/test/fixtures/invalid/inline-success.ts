import { Effect } from "effect";
import { command, contract, query } from "../../../src/index.ts";
import { notes } from "../../notes.ts";

const Inline = contract("inline", {
	queries: [query("list", { reads: () => [notes.list] })],
	commands: [command("touch", { invalidates: () => [notes.list] })],
});

Inline.of({
	"inline.list": () => Effect.void,
	"inline.touch": () => Effect.succeed(5),
});
