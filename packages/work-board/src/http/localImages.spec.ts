import { afterEach, beforeEach, expect, it } from "vitest";
import { changesUntil, rawGet, subscribe } from "#test/board.ts";
import { SCREENSHOT, visualWorkspace } from "#test/visuals.ts";

let workspace: Awaited<ReturnType<typeof visualWorkspace>>;
beforeEach(async () => {
	workspace = await visualWorkspace();
});
afterEach(async () => {
	await workspace.stop();
});

it("renders source-relative local images at a nested home alias and serves exact bytes with safe media headers", async () => {
	const html = await (await workspace.get("/")).text();
	expect(html).toContain('src="/_board/attachment/shots/first%20%26%20review.png"');
	expect(html).toContain('alt="First screenshot"');
	const image = await workspace.get("/_board/attachment/shots/first%20%26%20review.png");
	expect(image.status).toBe(200);
	expect(image.headers.get("content-type")).toBe("image/png");
	expect(image.headers.get("cache-control")).toBe("no-store");
	expect(image.headers.get("x-content-type-options")).toBe("nosniff");
	expect(Buffer.from(await image.arrayBuffer())).toEqual(SCREENSHOT);
	const result = await (await workspace.get("/nested/result.md")).text();
	expect(result).toContain('href="/_board/attachment/shots/first%20%26%20review.png"');
	expect(result).toContain("Recorded evidence");
});

it("refuses traversal, malformed paths, unsupported types and escaping file or directory links", async () => {
	workspace.outsideLinks();
	for (const path of [
		"shots/leak.png",
		"reference/outside.png",
		"..%2fprivate.png",
		"%2e%2e%5cprivate.png",
		"%ZZ.png",
		".hidden.png",
		"nested/home.md",
		"shots/evil.svg",
		"node_modules/image.png",
		"shots/a.constructor",
	]) {
		const response = await rawGet(workspace.board, `/_board/attachment/${path}`);
		expect(response.status).toBe(404);
		expect(response.body).not.toContain("private");
	}
	expect((await rawGet(workspace.board, "/_board/attachment/shots/second.png", "outside.example")).status).toBe(403);
});

it("bounds image reads and reports image edits through the existing watcher", async () => {
	const events = await subscribe(workspace.board);
	workspace.replaceImage();
	expect((await changesUntil(events, "shots/second.png")).at(-1)).toContain("shots/second.png");
	events.close();
	workspace.oversize();
	const response = await workspace.get("/_board/attachment/shots/second.png");
	expect(response.status).toBe(413);
	expect(await response.text()).toContain("16 MiB");
});
