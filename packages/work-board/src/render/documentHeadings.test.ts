import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";

boardStory.it(
	"assigns unambiguous Unicode anchors and excludes footnote and authored headings",
	[
		projectFiles({
			"headings.md":
				'# **Evidence**\n\n## Evidence\n\nA claim.[^source]\n\n[^source]: Proof.\n\n### Evidence-2\n\n### Evidence\n\n## Απόφαση\n\n## !!!\n\n<h2 id="authored">Kept</h2>',
		}),
	],
	function* ({ renderDocument }) {
		const html = yield* renderDocument("headings.md");
		for (const id of ["heading-evidence", "heading-evidence-2", "heading-evidence-2-2", "heading-evidence-3", "heading-απόφαση", "heading-section"]) {
			expect(html).toContain(`id="${id}"`);
		}
		expect(html).toContain('href="#heading-evidence-3"');
		expect(html).toContain('href="#user-content-fn-source"');
		expect(html).toContain('<h2 id="authored">Kept</h2>');
		expect([...html.matchAll(/\bid="(?<id>heading-[^"]+)"/gu)].map((match) => match.groups?.id)).toEqual([
			"heading-evidence",
			"heading-evidence-2",
			"heading-evidence-2-2",
			"heading-evidence-3",
			"heading-απόφαση",
			"heading-section",
		]);
	},
);
