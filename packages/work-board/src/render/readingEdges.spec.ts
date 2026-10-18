import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { TEXT_QUESTION } from "#test/coverageEdges.ts";

boardStory.it(
	"keeps unrecognized fenced languages readable without guessing a highlighter",
	[projectFiles({ "nested/home.md": "```consumer-specific-language\nvalue < limit\n```\n" })],
	function* ({ renderDocument }) {
		const html = yield* renderDocument("nested/home.md");
		expect(html).toContain("value &lt; limit");
		expect(html).toContain('class="language-consumer-specific-language"');
		expect(html).not.toContain("shiki-themes");
	},
);

boardStory.it(
	"renders an empty authored heading with a usable labeled section anchor",
	[projectFiles({ "nested/home.md": "##\n" })],
	function* ({ renderDocument }) {
		const html = yield* renderDocument("nested/home.md");
		expect(html).toContain('aria-label="Link to section"');
		expect(html).toContain('href="#heading-section"');
	},
);

boardStory.it(
	"renders questionnaire source as reading sections on ordinary document pages",
	[projectFiles({ "nested/home.md": TEXT_QUESTION })],
	function* ({ renderDocument }) {
		const html = yield* renderDocument("nested/home.md");
		expect(html).toContain('class="questionnaire-reading questionnaire-question"');
		expect(html).toContain("What should happen next?");
	},
);

boardStory.it(
	"discloses a visual component missing its required label instead of inventing one",
	[projectFiles({ "nested/home.md": ':::metric{value="1" unit="documents"}\nSource: [Checks](checks.md)\n:::\n' })],
	function* ({ renderDocument }) {
		const html = yield* renderDocument("nested/home.md");
		expect(html).toContain("Start with a Markdown label paragraph.");
		expect(html).toContain(":::metric");
		expect(html).not.toContain('class="visual-document visual-metric"');
	},
);

boardStory.it(
	"accepts an authored reference-style source link as visual provenance",
	[
		projectFiles({
			"nested/home.md": ':::metric{value="1" unit="documents"}\nReviewed files\n\nSource: [Checks][checks]\n:::\n\n[checks]: checks.md\n',
		}),
	],
	function* ({ renderDocument }) {
		const html = yield* renderDocument("nested/home.md");
		expect(html).toContain('class="visual-document visual-metric"');
		expect(html).toContain('href="/nested/checks.md"');
		expect(html).not.toContain("Visual component could not be rendered");
	},
);
