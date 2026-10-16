import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, rawGet, startBoard } from "#test/board.ts";

let notes: Folder;
afterEach(() => notes?.remove());
it.live("redirects every retired destination to its current view", function* () {
	notes = folder({ "note.md": "# Note" });
	const board = yield* startBoard(notes.root);
	for (const [route, location] of [
		["overview", "/"],
		["inbox", "/"],
		["changes", "/_board/library?view=recently-changed"],
		["diagnostics", "/_board/system"],
	]) {
		const response = yield* rawGet(board, `/_board/${route}`);
		expect(response.status).toBe(302);
		expect(response.location).toBe(location);
	}
	for (const route of ["/", "/note.md", "/_board/work", "/_board/start", "/_board/handoff", "/_board/result", "/_board/system"]) {
		const response = yield* rawGet(board, route);
		expect(response.status).toBe(200);
		expect(response.body).toContain("data-board-react-root");
		expect(response.body).not.toMatch(/<noscript|<template|<style|style\.css/u);
	}
	expect((yield* rawGet(board, "/_board/style.css")).status).toBe(404);
});
