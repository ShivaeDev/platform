import { contract } from "#contract.ts";
import { query } from "#operation.ts";
import { Note } from "#test/notes.ts";

contract("dupes", {
	queries: [
		query("get", { readPolicy: () => Effect.succeed(true), reads: () => [] }),
		query("get", { readPolicy: () => Effect.succeed(true), reads: () => [], success: Note }),
	],
});
