import { describe, expect, it } from "vitest";
import { headingAnchors } from "#docs/headingAnchors.ts";
import { markdownLines } from "#docs/markdownLines.ts";

function anchorsOf(...lines: readonly string[]): readonly string[] {
	return [...headingAnchors(markdownLines(lines.join("\n")))];
}

describe("headingAnchors", () => {
	it("forms GitHub's anchors from heading text, numbering repeats", () => {
		expect(
			anchorsOf("# `useQuery` and [links](./x.md)", "## 1. Once per feature: the API!", "## Install", "### Install", "Setext title", "---"),
		).toEqual(["usequery-and-links", "1-once-per-feature-the-api", "install", "install-1", "setext-title"]);
	});

	it("skips headings inside fences of any length and keeps explicit HTML anchors", () => {
		expect(anchorsOf("````md", "```", "# Not a heading", "```", "````", '<a id="Kept"></a>', "~~~", "# Also code", "~~~")).toEqual(["kept"]);
	});
});
