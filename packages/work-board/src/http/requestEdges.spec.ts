import { afterEach, expect, it } from "vitest";
import { type Folder, folder, type RunningBoard, rawGet, rawPost, startBoard } from "#test/board.ts";
import { growBeforeRead } from "#test/fileRaces.ts";
import { imageNamedDirectory, screenshotFile } from "#test/imageFixtures.ts";

let notes: Folder;
let board: RunningBoard;
afterEach(async () => {
	await board?.stop();
	notes?.remove();
});
async function open() {
	notes = folder({ "note.md": "# Reading context" });
	board = await startBoard(notes.root);
}

it("rejects a malformed Host header over real HTTP with the loopback policy message", async () => {
	await open();
	expect(await rawGet(board, "/", "[")).toEqual({ body: "Only loopback hosts are served", status: 403 });
});

it("rejects a malformed Origin at the real RPC boundary", async () => {
	await open();
	const response = await rawPost(board, "/_board/rpc", { "content-type": "application/json", host: `127.0.0.1:${board.port}`, origin: ":invalid:" });
	expect(response.status).toBe(403);
	expect(response.body).toBe("Local same-origin requests only");
});

it("reports an image-named directory as unavailable rather than attempting a file read", async () => {
	await open();
	imageNamedDirectory(notes.root);
	expect(await rawGet(board, "/_board/attachment/screenshot.png")).toEqual({
		body: "Local image unavailable: unsupported type, missing file or workspace boundary.",
		status: 404,
	});
});

it("rejects a real image growing beyond the byte limit between stat and read", async () => {
	notes = folder({ "note.md": "# Reading context" });
	const image = screenshotFile(notes.root);
	board = await startBoard(notes.root, undefined, growBeforeRead(image, 16 * 1024 * 1024 + 1));
	expect(await rawGet(board, "/_board/attachment/screenshot.png")).toEqual({ body: "Local image exceeds the 16 MiB limit.", status: 413 });
});
