import { join } from "node:path";
import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { localScreenshots, outsideFiles } from "#test/servingTraits.ts";
import { SCREENSHOT } from "#test/visuals.ts";

const images = boardStory.traits(
	projectFiles({
		"nested/home.md": "# Visual review\n\n![First](../shots/first%20%26%20review.png)",
		"nested/result.md": "# Result",
		"shots/a.constructor": "private",
		"shots/evil.svg": "<svg>private</svg>",
		"shots/first & review.png": "",
		"shots/second.png": "",
	}),
	boardHome("nested/home.md"),
	localScreenshots,
);
boardStory.it("resolves a nested home image and serves exact bytes with media headers", [images], function* ({ request, readDocument }) {
	expect((yield* readDocument("")).links["../shots/first%20%26%20review.png"]).toBe("/_board/attachment/shots/first%20%26%20review.png");
	const image = yield* request("/_board/attachment/shots/first%20%26%20review.png");
	expect(image.status).toBe(HttpStatus.fromLiteral("OK"));
	expect(image.headers.get("content-type")).toBe("image/png");
	expect(image.headers.get("cache-control")).toBe("no-store");
	expect(image.headers.get("x-content-type-options")).toBe("nosniff");
	expect(Buffer.from(yield* Effect.promise(() => image.arrayBuffer()))).toEqual(SCREENSHOT);
});
boardStory.it(
	"refuses traversal, unsupported types and escaping file and directory links",
	[images, outsideFiles({ "outside.png": "private" })],
	function* ({ outside, linkFile, get }) {
		linkFile("shots/leak.png", join(outside.root, "outside.png"));
		linkFile("reference", outside.root);
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
			const response = yield* get(`/_board/attachment/${path}`);
			expect(response.status).toBe(HttpStatus.fromLiteral("NotFound"));
			expect(response.body).not.toContain("private");
		}
		expect((yield* get("/_board/attachment/shots/second.png", "outside.example")).status).toBe(HttpStatus.fromLiteral("Forbidden"));
	},
);
boardStory.it("announces image edits and bounds image reads", [images], function* ({ watchProject, editBytes, resizeFile, get }) {
	const events = yield* watchProject();
	yield* events.next();
	editBytes("shots/second.png", Buffer.concat([SCREENSHOT, Buffer.from("Updated")]));
	expect(yield* events.next()).toEqual({ _tag: "Resync" });
	resizeFile("shots/second.png", 16 * 1024 * 1024 + 1);
	const response = yield* get("/_board/attachment/shots/second.png");
	expect(response.status).toBe(HttpStatus.fromLiteral("PayloadTooLarge"));
	expect(response.body).toContain("16 MiB");
});
