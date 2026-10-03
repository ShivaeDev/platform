import { command, contract, query } from "../../../src/index.ts";

contract("dupes", {
	commands: [command("save", { invalidates: () => [] }), command("save", { invalidates: () => [] })],
	queries: [query("list", { reads: () => [] })],
});
