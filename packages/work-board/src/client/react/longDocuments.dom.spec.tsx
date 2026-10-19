import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { finishDocumentBody, heldDocumentBody } from "#test/documentBodyTiming.ts";
import { failingSectionRender } from "#test/failingSectionRender.ts";
import { LATE_HEADING, LONG_REPORT, LONG_REPORT_TITLE, REWRITTEN_REPORT, REWRITTEN_SUMMARY } from "#test/longReportFixture.ts";
import { observedOutline } from "#test/observedOutline.ts";
import { screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen, routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const files = { "home.md": "# Home", "report.md": LONG_REPORT };

screenStory.it(
	"paints the title and item header of a long report before its body finishes rendering",
	[heldDocumentBody(), routedScreen(files, "/report.md")],
	function* ({ findElement, readAttribute, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#doc [data-page-header] h1")).toBe(LONG_REPORT_TITLE)));
		expect(readText("#doc article.doc")?.trim()).toBe("Opening summary of the research.");
		expect(findElement(`#${LATE_HEADING}`)).toBeNull();
		expect(readAttribute("#doc article.doc", "data-source")).toBeNull();
		expect(readAttribute("#doc", "data-route")).toBeNull();
		yield* Effect.promise(finishDocumentBody);
		yield* Effect.promise(() => eventually(() => expect(readAttribute("#doc", "data-route")).toBe("/report.md")));
		expect(readText(`#${LATE_HEADING}`)).toBe("Late follow-up");
		const late = findElement(`#${LATE_HEADING}`);
		expect(late && findElement("#heading-finding-40")?.compareDocumentPosition(late)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
	},
);

screenStory.it(
	"lands a deep link on a heading in the last section of a long report once that section renders",
	[heldDocumentBody(), routedScreen(files, `/report.md#${LATE_HEADING}`)],
	function* ({ findElement, readFocus, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#doc [data-page-header] h1")).toBe(LONG_REPORT_TITLE)));
		expect(findElement(`#${LATE_HEADING}`)).toBeNull();
		expect(readText("[role=status]")).not.toContain("no longer in the document");
		yield* Effect.promise(finishDocumentBody);
		yield* Effect.promise(() => eventually(() => expect(readFocus()?.id).toBe(LATE_HEADING)));
		expect(readText("[role=status]")).not.toContain("no longer in the document");
	},
);

screenStory.it(
	"marks the section the reader is in on the report outline as they scroll",
	[observedOutline(), chromeScreen(files, "/report.md")],
	function* ({ findElements, scrollToHeading }) {
		function current() {
			return [...findElements('.document-outline a[aria-current="location"]')].map((link) => link.getAttribute("href"));
		}
		yield* Effect.promise(() => eventually(() => expect(current()).toEqual(["#heading-long-research-report"])));
		scrollToHeading("heading-evidence-12");
		expect(current()).toEqual(["#heading-evidence-12"]);
		scrollToHeading("heading-finding-30");
		expect(current()).toEqual(["#heading-finding-30"]);
		scrollToHeading(LATE_HEADING);
		expect(current()).toEqual([`#${LATE_HEADING}`]);
	},
);

screenStory.it(
	"marks the current section in the phone outline menu",
	[screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]), observedOutline(), chromeScreen(files, "/report.md")],
	function* ({ click, findElement, scrollToHeading }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("[data-page-actions] [data-outline-menu]")).not.toBeNull()));
		scrollToHeading("heading-finding-7");
		click(findElement("[data-page-actions] [data-outline-menu]"));
		yield* Effect.promise(() =>
			eventually(() =>
				expect(findElement('[data-slot="popover-content"] a[aria-current="location"]', document)?.getAttribute("href")).toBe("#heading-finding-7"),
			),
		);
	},
);

screenStory.it(
	"keeps the new version of a long report when the file changes while the old version is still rendering",
	[heldDocumentBody(), routedScreen(files, "/report.md")],
	function* ({ editFile, findElement, readText, refreshDocument }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#doc [data-page-header] h1")).toBe(LONG_REPORT_TITLE)));
		editFile("report.md", REWRITTEN_REPORT);
		yield* Effect.promise(() => refreshDocument("/report.md"));
		yield* Effect.promise(() => eventually(() => expect(readText("#doc article.doc")?.trim()).toBe(REWRITTEN_SUMMARY)));
		yield* Effect.promise(finishDocumentBody);
		expect(readText("#doc article.doc")?.trim()).toBe(REWRITTEN_SUMMARY);
		expect(findElement("#heading-finding-1")).toBeNull();
	},
);

screenStory.it(
	"ignores a render failure in the old version of a long report once the file has changed",
	[heldDocumentBody(), failingSectionRender("Finding 1"), routedScreen(files, "/report.md")],
	function* ({ editFile, findElement, readText, refreshDocument }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#doc [data-page-header] h1")).toBe(LONG_REPORT_TITLE)));
		editFile("report.md", REWRITTEN_REPORT);
		yield* Effect.promise(() => refreshDocument("/report.md"));
		yield* Effect.promise(() => eventually(() => expect(readText("#doc article.doc")?.trim()).toBe(REWRITTEN_SUMMARY)));
		yield* Effect.promise(finishDocumentBody);
		expect(readText("#doc article.doc")?.trim()).toBe(REWRITTEN_SUMMARY);
		expect(findElement("pre code")).toBeNull();
	},
);
