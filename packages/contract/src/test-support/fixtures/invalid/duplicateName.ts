import { contract } from "#contract.ts";
import { command, query } from "#operation.ts";

contract("dupes", {
	commands: [command("same", { invalidates: () => [] })],
	queries: [query("same", { readPolicy: () => Effect.succeed(true), reads: () => [] })],
});
