import { describe } from "@effect/vitest";
import { it } from "@shivaedev/test/adapters/it.ts";
import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { headingAnchors } from "#docs/headingAnchors.ts";
import { markdownLines } from "#docs/markdownLines.ts";

function anchorsOf(...lines: readonly string[]): readonly string[] {
	return [...headingAnchors(markdownLines(lines.join("\n")))];
}

describe("headingAnchors", () => {
	it.effect("forms GitHub's anchors from heading text, numbering repeats", function* () {
		yield* assertThat(
			anchorsOf("# `useQuery` and [links](./x.md)", "## 1. Once per feature: the API!", "## Install", "### Install", "Setext title", "---"),
			(actual) => actual.toEqual(["usequery-and-links", "1-once-per-feature-the-api", "install", "install-1", "setext-title"]),
		);
	});

	it.effect("skips headings inside fences of any length and keeps explicit HTML anchors", function* () {
		yield* assertThat(anchorsOf("````md", "```", "# Not a heading", "```", "````", '<a id="Kept"></a>', "~~~", "# Also code", "~~~"), (actual) =>
			actual.toEqual(["kept"]),
		);
	});
});
