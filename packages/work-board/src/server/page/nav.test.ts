import { expect, it } from "vitest";
import { navHtml } from "./nav.ts";

it("links to Library without serializing the workspace tree", () => {
	expect(navHtml([{ modified: 1, path: "deep/slug.md" }], "deep/slug.md", undefined)).toContain('<a href="/_board/library">Library (1)</a>');
});
