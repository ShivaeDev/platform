import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, rawGet } from "#test/board.ts";
import { embeddedBoard } from "#test/embeddedBoard.ts";
import { renderRemaining } from "#test/remainingRendering.tsx";

let notes: Folder | undefined;

afterEach(() => {
	notes?.remove();
});

it.live("embeds reading routes beside an application's health route without relaxing the board boundary", function* () {
	notes = folder({ "evidence.md": "# Recorded evidence\n", "plan.md": "# Embedded project\n\n[Evidence](evidence.md)\n" });
	const board = yield* embeddedBoard(notes.root);
	expect(yield* Effect.promise(async () => (await fetch(`${board.url}/health`)).text())).toBe("healthy");
	expect(yield* Effect.promise(async () => (await fetch(`${board.url}/plan.md`)).text())).toContain("data-board-react-root");
	expect(yield* Effect.promise(async () => (await fetch(`${board.url}/evidence.md`)).text())).toContain("data-board-react-root");
	expect(yield* Effect.promise(() => renderRemaining(board.url, "/_board/start"))).toContain("Project and report templates");
	expect((yield* rawGet(board, "/plan.md", "untrusted.example")).status).toBe(403);
	expect((yield* rawGet(board, "/_board/react.js", "untrusted.example")).status).toBe(403);
	expect((yield* rawGet(board, "/_board/native.js")).status).toBe(404);
	expect((yield* rawGet(board, "/health", "untrusted.example")).body).toBe("healthy");
	const url = board.url;
	yield* board.stop();
	yield* Effect.promise(() => expect(fetch(`${url}/health`)).rejects.toThrow());
});
