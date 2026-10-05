import { contract } from "#contract.ts";
import { query } from "#operation.ts";
import { Note } from "#test/notes.ts";

contract("dupes", {
	queries: [query("get", { reads: () => [] }), query("get", { reads: () => [], success: Note })],
});
