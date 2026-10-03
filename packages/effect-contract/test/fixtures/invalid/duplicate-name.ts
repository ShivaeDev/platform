import { command, contract, query } from "../../../src/index.ts";

contract("dupes", {
	commands: [command("same", { invalidates: () => [] })],
	queries: [query("same", { reads: () => [] })],
});
