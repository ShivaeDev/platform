import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { chunkResponse } from "#test/chunkResponse.ts";
import { LATE_HEADING, LONG_REPORT, LONG_REPORT_TITLE, REWRITTEN_REPORT, REWRITTEN_SUMMARY } from "#test/longReportFixture.ts";
import { observedOutline } from "#test/observedOutline.ts";
import { readingPage } from "#test/readingScreenTraits.tsx";
import { screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

const files = { "home.md": "# Home", "report.md": LONG_REPORT };

screenStory.it(
	"a long report keeps its shell while the Markdown chunk waits, and shows its title and last section after the chunk arrives",
	[chunkResponse("markdown", "held"), readingPage(files, "/report.md")],
	function* ({ documentBody, chunkArrives, documentShell, headerTitle, lastHeading }) {
		yield* outcomes([
			["body", () => documentBody(), ""],
			["last heading", () => lastHeading(), "none"],
			["shell", () => documentShell(), "the shell the page opened in"],
		]);

		yield* chunkArrives();

		yield* outcomes([
			["shell", () => documentShell(), "the shell the page opened in"],
			["title", () => headerTitle(), LONG_REPORT_TITLE],
			["last heading", () => lastHeading(), "Late follow-up"],
		]);
	},
);

screenStory.it(
	"a deep link to a heading in the last section of a long report lands focus there once that section renders, without a missing-section notice",
	[chunkResponse("markdown", "held"), readingPage(files, `/report.md#${LATE_HEADING}`)],
	function* ({ chunkArrives, lastHeading, navigationStatus, readerFocus }) {
		yield* outcomes([
			["last heading", () => lastHeading(), "none"],
			["status", () => navigationStatus(), { state: "normal", text: "" }],
		]);

		yield* chunkArrives();

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
	"when a report changes while the Markdown chunk waits, the arriving chunk renders the new version",
	[chunkResponse("markdown", "held"), readingPage(files, "/report.md")],
	function* ({ documentBody, chunkArrives, rewriteDocument }) {
		yield* rewriteDocument("report.md", REWRITTEN_REPORT);
		expect(yield* documentBody()).toBe("");

		yield* chunkArrives();

		expect(yield* documentBody()).toBe(REWRITTEN_SUMMARY);
	},
);
