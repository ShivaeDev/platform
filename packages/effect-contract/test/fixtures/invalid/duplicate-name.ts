import { command, contract, query } from "#index.ts";

contract("dupes", {
	commands: [command("same", { invalidates: () => [] })],
	queries: [query("same", { reads: () => [] })],
});
