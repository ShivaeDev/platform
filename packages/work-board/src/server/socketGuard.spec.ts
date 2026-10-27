import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";

boardStory.it(
	"answers socket RPC while TCP retains its Host and Origin checks",
	[projectFiles({ "note.md": "# Notes" })],
	function* ({ board, notes, socketCall, post }) {
		for (const tcp of [false, true]) {
			expect(yield* socketCall("work-board.server", tcp)).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						_tag: "Exit",
						exit: { _tag: "Success", value: { directory: notes.root, url: `${board.url}/` } },
					}),
				]),
			);
		}
		const message = `${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: null, tag: "work-board.server" })}\n`;
		for (const headers of [{ host: "untrusted.example" }, { origin: "http://untrusted.example" }]) {
			expect((yield* post("/_board/rpc", { "content-type": "application/ndjson", ...headers }, message)).status).toBe(
				HttpStatus.fromLiteral("Forbidden"),
			);
		}
	},
);
