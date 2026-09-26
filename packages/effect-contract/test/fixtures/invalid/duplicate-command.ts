import { command, contract, query } from "../../../src/index.ts";

contract("dupes", {
	queries: [query("list", { reads: () => [] })],
	commands: [command("save", { invalidates: () => [] }), command("save", { invalidates: () => [] })],
});
