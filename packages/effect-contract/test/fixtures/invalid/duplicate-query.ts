import { contract, query } from "../../../src/index.ts";
import { Note } from "../../notes.ts";

contract("dupes", {
	queries: [query("get", { reads: () => [] }), query("get", { success: Note, reads: () => [] })],
});
