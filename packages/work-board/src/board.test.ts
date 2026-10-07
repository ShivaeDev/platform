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

	it("refuses a request without a Host header", async () => {
		expect((await board.handler(new Request("http://localhost/"))).status).toBe(403);
	});

	it("still refuses a request addressed to a host that is not loopback", async () => {
		const response = await board.handler(new Request("http://board.example/", { headers: { host: "board.example" } }));
		expect(response.status).toBe(403);
	});
});
