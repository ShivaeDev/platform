import { readFileSync } from "node:fs";
import { NodeServices } from "@effect/platform-node";
import { Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { boardLayer } from "#board.ts";
import { type Folder, folder } from "#test/board.ts";

function embed(root: string) {
	return HttpRouter.toWebHandler(Layer.provide(boardLayer({ home: "plan.md", root }), NodeServices.layer));
}

let notes: Folder;
let board: ReturnType<typeof embed>;

beforeEach(() => {
	notes = folder({ "plan.md": "# Plan\n\n## To do\n\n### `docs` Write the intro\n" });
	board = embed(notes.root);
});

afterEach(async () => {
	await board.dispose();
	notes.remove();
});

describe("embedding", () => {
	it("serves the board as a fetch handler", async () => {
		const response = await board.handler(new Request("http://localhost/", { headers: { host: "localhost" } }));
		expect(response.status).toBe(200);
		expect(await response.text()).toContain("<span><b>1</b> to do</span>");
	});

	it("serves the React shell and its bundle beside the native client", async () => {
		for (const [path, type] of [
			["react.js", "javascript"],
			["react.css", "text/css"],
			["native.js", "javascript"],
		]) {
			const response = await board.handler(new Request(`http://localhost/_board/${path}`, { headers: { host: "localhost" } }));
			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toContain(type);
			const body = await response.text();
			expect(body).toBe(readFileSync(new URL(`../assets/${path}`, import.meta.url), "utf8"));
			if (path === "native.js") {
				expect(body).toContain("/* @shivaedev/work-board native browser bundle */");
			}
		}
		const page = await board.handler(new Request("http://localhost/", { headers: { host: "localhost" } }));
		const html = await page.text();
		expect(html).toContain("<span><b>1</b> to do</span>");
		expect(html).toContain("/_board/react.js");
		expect(html).toContain("/_board/react.css");
		expect(html).not.toContain("/_board/client.js");
		expect(html).toContain('<div data-board-react-root></div><template id="board-legacy-page">');
	});

	it("refuses a request without a Host header", async () => {
		expect((await board.handler(new Request("http://localhost/"))).status).toBe(403);
	});

	it("still refuses a request addressed to a host that is not loopback", async () => {
		const response = await board.handler(new Request("http://board.example/", { headers: { host: "board.example" } }));
		expect(response.status).toBe(403);
	});
});

it("has no duplicate search, history or SSE endpoint", async () => {
	for (const [method, path] of [
		["GET", "/_board/search?q=Plan"],
		["POST", "/_board/history"],
		["GET", "/events"],
	] as const) {
		const response = await board.handler(new Request(`http://localhost${path}`, { headers: { host: "localhost" }, method }));
		expect(response.status).toBe(404);
	}
});
