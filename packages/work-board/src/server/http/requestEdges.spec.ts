import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { growBeforeRead } from "#test/fileRaces.ts";
import { imageNamedDirectory, screenshotFile } from "#test/imageFixtures.ts";

boardStory.it(
	"rejects a malformed Host header over real HTTP with the loopback policy message",
	[projectFiles({ "note.md": "# Reading context" })],
	function* ({ get }) {
		expect(yield* get("/", "[")).toEqual({ body: "Only loopback hosts are served", status: HttpStatus.fromLiteral("Forbidden") });
	},
);

boardStory.it("rejects a malformed Origin at the real RPC boundary", [projectFiles({ "note.md": "# Reading context" })], function* ({ post, board }) {
	const response = yield* post("/_board/rpc", { "content-type": "application/json", host: `127.0.0.1:${board.port}`, origin: ":invalid:" });
	expect(response.status).toBe(HttpStatus.fromLiteral("Forbidden"));
	expect(response.body).toBe("Local same-origin requests only");
});

boardStory.it(
	"keeps the Board's larger RPC allowance while rejecting bodies beyond it",
	[projectFiles({ "note.md": "# Reading context" })],
	function* ({ post }) {
		function message(padding: number) {
			return `${JSON.stringify({ _tag: "Request", headers: [["x-padding", "x".repeat(padding)]], id: "1", payload: null, tag: "work-board.watcher" })}\n`;
		}
		const headers = { "content-type": "application/ndjson" };
		const accepted = yield* post("/_board/rpc", headers, message(1024 * 1024));
		expect(accepted.status).toBe(HttpStatus.fromLiteral("OK"));
		expect(accepted.body).toContain('"_tag":"Success"');
		const refused = yield* post("/_board/rpc", headers, message(8 * 1024 * 1024 + 4096));
		expect(refused.status).toBeGreaterThanOrEqual(HttpStatus.fromLiteral("BadRequest"));
		expect(refused.status).toBeLessThan(HttpStatus.fromLiteral("InternalServerError"));
	},
);

boardStory.it(
	"reports an image-named directory as unavailable rather than attempting a file read",
	[projectFiles({ "note.md": "# Reading context" })],
	function* ({ notes, get }) {
		imageNamedDirectory(notes.root);
		expect(yield* get("/_board/attachment/screenshot.png")).toEqual({
			body: "Local image unavailable: unsupported type, missing file or workspace boundary.",
			status: HttpStatus.fromLiteral("NotFound"),
		});
	},
);

boardStory.it(
	"rejects a real image growing beyond the byte limit between stat and read",
	[projectFiles({ "note.md": "# Reading context" }), deferredServing],
	function* ({ notes, start, get }) {
		const image = screenshotFile(notes.root);
		yield* start({ wrap: growBeforeRead(image, 16 * 1024 * 1024 + 1) });
		expect(yield* get("/_board/attachment/screenshot.png")).toEqual({
			body: "Local image exceeds the 16 MiB limit.",
			status: HttpStatus.fromLiteral("PayloadTooLarge"),
		});
	},
);
