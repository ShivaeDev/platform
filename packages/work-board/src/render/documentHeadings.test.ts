import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";

const headings = projectFiles({
	"headings.md":
		'# **Evidence**\n\n## Evidence\n\nA claim.[^source]\n\n[^source]: Proof.\n\n### Evidence-2\n\n### Evidence\n\n## Απόφαση\n\n## !!!\n\n<h2 id="authored">Kept</h2>',
});

boardStory.it(
	"each generated heading gets its own anchor, numbered past a written anchor of the same name, kept in Unicode and named section when it has no words",
	[headings],
	function* ({ renderedAttributes }) {
		expect(yield* renderedAttributes("headings.md", "[id^='heading-']", "id")).toEqual([
			"heading-evidence",
			"heading-evidence-2",
			"heading-evidence-2-2",
			"heading-evidence-3",
			"heading-απόφαση",
			"heading-section",
		]);
	},
);

boardStory.it(
	"a heading written with its own HTML anchor keeps it, and footnotes get no heading anchor",
	[headings],
	function* ({ renderedAttributes }) {
		yield* outcomes([
			["authored heading", () => renderedAttributes("headings.md", "h2#authored", "id"), ["authored"]],
			["footnote links", () => renderedAttributes("headings.md", "sup a", "href"), ["#user-content-fn-source"]],
			["heading links", () => renderedAttributes("headings.md", "a[href^='#heading-']", "href"), expect.arrayContaining(["#heading-evidence-3"])],
		]);
	},
);
