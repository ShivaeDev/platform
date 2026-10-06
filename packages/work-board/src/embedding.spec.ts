import { afterEach, expect, it } from "vitest";
import { type Folder, folder, type RunningBoard, rawGet } from "#test/board.ts";
import { embeddedBoard } from "#test/embeddedBoard.ts";

let notes: Folder | undefined;
let board: RunningBoard | undefined;

afterEach(async () => {
	await board?.stop();
	notes?.remove();
});

it("embeds reading routes beside an application's health route without relaxing the board boundary", async () => {
	notes = folder({ "evidence.md": "# Recorded evidence\n", "plan.md": "# Embedded project\n\n[Evidence](evidence.md)\n" });
	board = await embeddedBoard(notes.root);
	expect(await (await fetch(`${board.url}/health`)).text()).toBe("healthy");
	expect(await (await fetch(`${board.url}/plan.md`)).text()).toContain('href="/evidence.md"');
	expect(await (await fetch(`${board.url}/evidence.md`)).text()).toContain("Recorded evidence");
	expect(await (await fetch(`${board.url}/_board/start`)).text()).toContain("Project and report templates");
	expect((await rawGet(board, "/plan.md", "untrusted.example")).status).toBe(403);
	expect((await rawGet(board, "/_board/native.js", "untrusted.example")).status).toBe(403);
	expect((await rawGet(board, "/health", "untrusted.example")).body).toBe("healthy");
	const url = board.url;
	await board.stop();
	board = undefined;
	await expect(fetch(`${url}/health`)).rejects.toThrow();
});
