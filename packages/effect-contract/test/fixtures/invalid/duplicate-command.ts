import { contract } from "#contract.ts";
import { command, query } from "#operation.ts";

contract("dupes", {
	commands: [command("save", { invalidates: () => [] }), command("save", { invalidates: () => [] })],
	queries: [query("list", { reads: () => [] })],
});
