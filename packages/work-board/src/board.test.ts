import { readFileSync } from "node:fs";
import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { afterEach, describe, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { boardLayer } from "#board.ts";
import { type Folder, folder } from "#test/board.ts";

function embed(root: string) {
	return HttpRouter.toWebHandler(Layer.provide(boardLayer({ home: "plan.md", root }), NodeServices.layer));
}

let notes: Folder;
let board: ReturnType<typeof embed>;

const setupBoard = Effect.sync(() => {
	notes = folder({ "plan.md": "# Plan\n\n## To do\n\n### `docs` Write the intro\n" });
	board = embed(notes.root);
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

afterEach(async () => {
	await board.dispose();
	notes.remove();
});

describe("embedding", () => {
	effectApp("serves the board as a fetch handler", function* () {
		const response = yield* Effect.promise(() => board.handler(new Request("http://localhost/", { headers: { host: "localhost" } })));
		expect(response.status).toBe(200);
		expect(yield* Effect.promise(() => response.text())).toContain("<span><b>1</b> to do</span>");
	});

	effectApp("serves the React bundle and theme beside the native client without changing the page", function* () {
		const handler = board.handler;
		for (const [path, type] of [
			["react.js", "javascript"],
			["react.css", "text/css"],
			["native.js", "javascript"],
		]) {
			const response = yield* Effect.promise(() => handler(new Request(`http://localhost/_board/${path}`, { headers: { host: "localhost" } })));
			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toContain(type);
			expect(yield* Effect.promise(() => response.text())).toBe(readFileSync(new URL(`../assets/${path}`, import.meta.url), "utf8"));
		}
		const page = yield* Effect.promise(() => handler(new Request("http://localhost/", { headers: { host: "localhost" } })));
		const html = yield* Effect.promise(() => page.text());
		expect(html).toContain("<span><b>1</b> to do</span>");
		expect(html).not.toContain("/_board/react.js");
		expect(html).not.toContain("/_board/react.css");
		expect(html).not.toContain("data-board-react-root");
	});

	effectApp("refuses a request without a Host header", function* () {
		expect((yield* Effect.promise(() => board.handler(new Request("http://localhost/")))).status).toBe(403);
	});

	effectApp("still refuses a request addressed to a host that is not loopback", function* () {
		const response = yield* Effect.promise(() => board.handler(new Request("http://board.example/", { headers: { host: "board.example" } })));
		expect(response.status).toBe(403);
	});
});

effectApp("has no duplicate search, history or SSE endpoint", function* () {
	const handler = board.handler;
	for (const [method, path] of [
		["GET", "/_board/search?q=Plan"],
		["POST", "/_board/history"],
		["GET", "/events"],
	] as const) {
		const response = yield* Effect.promise(() => handler(new Request(`http://localhost${path}`, { headers: { host: "localhost" }, method })));
		expect(response.status).toBe(404);
	}
});
