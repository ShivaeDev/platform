import { Effect, Layer } from "effect";
import { expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { rawGet } from "#test/board.ts";
import { subscribe } from "#test/nativeRpc.ts";
import { SCREENSHOT, visualWorkspace } from "#test/visuals.ts";

let workspace: Effect.Success<ReturnType<typeof visualWorkspace>>;

const setupBoard = Effect.gen(function* () {
	workspace = yield* visualWorkspace();
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

effectApp("renders source-relative local images at a nested home alias and serves exact bytes with safe media headers", function* () {
	const html = yield* Effect.promise(async () => (await workspace.get("/")).text());
	expect(html).toContain('src="/_board/attachment/shots/first%20%26%20review.png"');
	expect(html).toContain('alt="First screenshot"');
	const image = yield* Effect.promise(() => workspace.get("/_board/attachment/shots/first%20%26%20review.png"));
	expect(image.status).toBe(200);
	expect(image.headers.get("content-type")).toBe("image/png");
	expect(image.headers.get("cache-control")).toBe("no-store");
	expect(image.headers.get("x-content-type-options")).toBe("nosniff");
	expect(Buffer.from(yield* Effect.promise(() => image.arrayBuffer()))).toEqual(SCREENSHOT);
	const result = yield* Effect.promise(async () => (await workspace.get("/nested/result.md")).text());
	expect(result).toContain('href="/_board/attachment/shots/first%20%26%20review.png"');
	expect(result).toContain("Recorded evidence");
});

effectApp("refuses traversal, malformed paths, unsupported types and escaping file or directory links", function* () {
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
		const response = yield* rawGet(workspace.board, `/_board/attachment/${path}`);
		expect(response.status).toBe(404);
		expect(response.body).not.toContain("private");
	}
	expect((yield* rawGet(workspace.board, "/_board/attachment/shots/second.png", "outside.example")).status).toBe(403);
});

effectApp("bounds image reads and reports image edits through the existing watcher", function* () {
	const events = yield* subscribe(workspace.board);
	yield* events.next();
	workspace.replaceImage();
	expect(yield* events.next()).toEqual({ _tag: "Resync" });
	yield* events.close();
	workspace.oversize();
	const response = yield* Effect.promise(() => workspace.get("/_board/attachment/shots/second.png"));
	expect(response.status).toBe(413);
	expect(yield* Effect.promise(() => response.text())).toContain("16 MiB");
});
