import { contract, query } from "#index.ts";
import { Note } from "#test/notes.ts";

contract("dupes", {
	queries: [query("get", { reads: () => [] }), query("get", { reads: () => [], success: Note })],
});
