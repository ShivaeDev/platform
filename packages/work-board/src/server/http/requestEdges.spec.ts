import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, type RunningBoard, rawGet, rawPost, startBoard } from "#test/board.ts";
import { growBeforeRead } from "#test/fileRaces.ts";
import { imageNamedDirectory, screenshotFile } from "#test/imageFixtures.ts";

let notes: Folder;
let board: RunningBoard;

afterEach(() => {
	notes?.remove();
});

const open = Effect.fn("Test.open")(function* () {
	notes = folder({ "note.md": "# Reading context" });
	board = yield* startBoard(notes.root);
});

it.live("rejects a malformed Host header over real HTTP with the loopback policy message", function* () {
	yield* open();
	expect(yield* rawGet(board, "/", "[")).toEqual({ body: "Only loopback hosts are served", status: 403 });
});

it.live("rejects a malformed Origin at the real RPC boundary", function* () {
	yield* open();
	const response = yield* rawPost(board, "/_board/rpc", { "content-type": "application/json", host: `127.0.0.1:${board.port}`, origin: ":invalid:" });
	expect(response.status).toBe(403);
	expect(response.body).toBe("Local same-origin requests only");
});

it.live("reports an image-named directory as unavailable rather than attempting a file read", function* () {
	yield* open();
	imageNamedDirectory(notes.root);
	expect(yield* rawGet(board, "/_board/attachment/screenshot.png")).toEqual({
		body: "Local image unavailable: unsupported type, missing file or workspace boundary.",
		status: 404,
	});
});

it.live("rejects a real image growing beyond the byte limit between stat and read", function* () {
	notes = folder({ "note.md": "# Reading context" });
	const image = screenshotFile(notes.root);
	board = yield* startBoard(notes.root, undefined, growBeforeRead(image, 16 * 1024 * 1024 + 1));
	expect(yield* rawGet(board, "/_board/attachment/screenshot.png")).toEqual({
		body: "Local image exceeds the 16 MiB limit.",
		status: 413,
	});
});
