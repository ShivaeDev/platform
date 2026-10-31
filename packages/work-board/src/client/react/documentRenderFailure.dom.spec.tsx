import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { failingSectionRender } from "#test/failingSectionRender.ts";
import { LONG_REPORT } from "#test/longReportFixture.ts";
import { readingPage } from "#test/readingScreenTraits.tsx";
import { screenStory } from "#test/screenStory.ts";

screenStory.it(
	"a long report whose later section fails to render shows the rendering error instead of a partial report",
	[failingSectionRender("Finding 1"), readingPage({ "home.md": "# Home", "report.md": LONG_REPORT }, "/report.md")],
	function* ({ headingAnchors, renderingError }) {
		yield* outcomes({
			error: [renderingError(), "Rendering failed on Finding 1"],
			"report headings": [headingAnchors(), expect.not.arrayContaining(["heading-finding-1"])],
		});
	},
);
