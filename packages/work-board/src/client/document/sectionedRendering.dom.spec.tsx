import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/react/client/testing.ts";
import { documentData } from "#test/documentRendering.ts";
import { REFERENCED_DOCUMENT, SECTIONED_DOCUMENT, SECTIONED_TITLE, WHOLE_DOCUMENT } from "#test/longReportFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { DocumentView } from "./View.ts";

expectNoReactWarnings();

screenStory.it(
	"renders a long document section by section exactly as one render of the whole document",
	[
		componentScreen(
			<>
				<DocumentView document={documentData(SECTIONED_DOCUMENT)} />
				<DocumentView document={documentData(WHOLE_DOCUMENT)} />
			</>,
		),
	],
	function* ({ findElements }) {
		function views() {
			return [...findElements("article.doc")];
		}
		yield* eventually(() => expect(views().map((view) => view.querySelector("#heading-repeat-2")?.textContent)).toEqual(["Repeat", "Repeat"]));
		const [sectioned, whole] = views().map((view) => [...view.children].map((block) => block.outerHTML));
		expect(sectioned).toEqual(whole);
		expect([...(views()[0]?.querySelectorAll("h1") ?? [])].map((title) => title.textContent)).toEqual([SECTIONED_TITLE]);
		expect(views()[0]?.querySelector("details #heading-inside-the-details")).not.toBeNull();
	},
);

screenStory.it(
	"resolves reference links and footnotes across a long document",
	[componentScreen(<DocumentView document={documentData(REFERENCED_DOCUMENT)} />)],
	function* ({ findElement, readAttribute }) {
		yield* eventually(() => expect(findElement("a[data-footnote-ref]")).not.toBeNull());
		expect(readAttribute('a[href="/nested/guide.md"]', "href")).toBe("/nested/guide.md");
		expect(findElement("#user-content-fn-source")?.textContent).toContain("Read the source.");
	},
);
