import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { failingSectionRender } from "#test/failingSectionRender.ts";
import { heldDocumentBody } from "#test/heldDocumentBody.ts";
import { LATE_HEADING, LONG_REPORT, LONG_REPORT_TITLE, REWRITTEN_REPORT, REWRITTEN_SUMMARY } from "#test/longReportFixture.ts";
import { observedOutline } from "#test/observedOutline.ts";
import { readingPage } from "#test/readingScreenTraits.tsx";
import { screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

const files = { "home.md": "# Home", "report.md": LONG_REPORT };
const OPENING = "Opening summary of the research.";

screenStory.it(
	"a long report shows its title and opening while the rest of its body waits, and its last section follows once the browser is free",
	[heldDocumentBody(), readingPage(files, "/report.md")],
	function* ({ documentBody, documentBodyFinishes, headerTitle, lastHeading }) {
		yield* outcomes([
			["body", () => documentBody(), OPENING],
			["last heading", () => lastHeading(), "none"],
			["title", () => headerTitle(), LONG_REPORT_TITLE],
		]);

		yield* documentBodyFinishes();

		expect(yield* lastHeading()).toBe("Late follow-up");
	},
);

screenStory.it(
	"a deep link to a heading in the last section of a long report lands focus there once that section renders, without a missing-section notice",
	[heldDocumentBody(), readingPage(files, `/report.md#${LATE_HEADING}`)],
	function* ({ documentBodyFinishes, lastHeading, navigationStatus, readerFocus }) {
		yield* outcomes([
			["last heading", () => lastHeading(), "none"],
			["status", () => navigationStatus(), { state: "normal", text: "" }],
		]);

		yield* documentBodyFinishes();

		yield* outcomes([
			["focus", () => readerFocus(), "heading Late follow-up Link to Late follow-up"],
			["status", () => navigationStatus(), { state: "normal", text: "" }],
		]);
	},
);

for (const heading of ["heading-evidence-12", "heading-finding-30", LATE_HEADING]) {
	screenStory.it(
		`the report outline marks ${heading} as current once the reader scrolls it to the top`,
		[observedOutline(), readingPage(files, "/report.md")],
		function* ({ currentSection, scrollToHeading }) {
			expect(yield* currentSection("outline")).toBe("#heading-long-research-report");

			yield* scrollToHeading(heading);

			expect(yield* currentSection("outline")).toBe(`#${heading}`);
		},
	);
}

screenStory.it(
	"on a phone, the On this page menu marks the section the reader scrolled to",
	[screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]), observedOutline(), readingPage(files, "/report.md")],
	function* ({ currentSection, openOutlineMenu, scrollToHeading }) {
		yield* scrollToHeading("heading-finding-7");

		yield* openOutlineMenu();

		expect(yield* currentSection("On this page menu")).toBe("#heading-finding-7");
	},
);

screenStory.it(
	"when a long report changes while its old version is still rendering, the old render finishing leaves the new version in place",
	[heldDocumentBody(), readingPage(files, "/report.md")],
	function* ({ documentBody, documentBodyFinishes, rewriteDocument }) {
		yield* rewriteDocument("report.md", REWRITTEN_REPORT);
		expect(yield* documentBody()).toBe(REWRITTEN_SUMMARY);

		yield* documentBodyFinishes();

		expect(yield* documentBody()).toBe(REWRITTEN_SUMMARY);
	},
);

screenStory.it(
	"when a long report changes while its old version is still rendering, a render failure in the old version shows no error",
	[heldDocumentBody(), failingSectionRender("Finding 1"), readingPage(files, "/report.md")],
	function* ({ documentBody, documentBodyFinishes, renderingError, rewriteDocument }) {
		yield* rewriteDocument("report.md", REWRITTEN_REPORT);
		expect(yield* documentBody()).toBe(REWRITTEN_SUMMARY);

		yield* documentBodyFinishes();

		yield* outcomes([
			["body", () => documentBody(), REWRITTEN_SUMMARY],
			["error", () => renderingError(), "none"],
		]);
	},
);
