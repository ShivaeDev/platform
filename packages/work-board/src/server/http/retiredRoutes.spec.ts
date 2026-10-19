import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";

boardStory.it(
	"redirects every retired destination to its current view",
	[projectFiles({ "note.md": "# Note" }), deferredServing],
	function* ({ start, get }) {
		yield* start();
		for (const [route, location] of [
			["overview", "/"],
			["inbox", "/"],
			["changes", "/_board/library?view=recently-changed"],
			["diagnostics", "/_board/system"],
			["result?item=result.keyboard", "/_board/item/result.keyboard/"],
			["result", "/_board/library?kind=result"],
		]) {
			const response = yield* get(`/_board/${route}`);
			expect(response.status).toBe(302);
			expect(response.location).toBe(location);
		}
		for (const route of ["/", "/note.md", "/_board/work", "/_board/start", "/_board/handoff", "/_board/system"]) {
			const response = yield* get(route);
			expect(response.status).toBe(200);
			expect(response.body).toContain("data-board-react-root");
			expect(response.body).not.toMatch(/<noscript|<template|<style|style\.css/u);
		}
		expect((yield* get("/_board/style.css")).status).toBe(404);
	},
);
