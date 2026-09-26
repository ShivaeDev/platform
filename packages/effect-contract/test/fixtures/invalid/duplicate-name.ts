import { command, contract, query } from "../../../src/index.ts";

contract("dupes", {
	queries: [query("same", { reads: () => [] })],
	commands: [command("same", { invalidates: () => [] })],
});
