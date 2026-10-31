import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { documentData } from "#test/documentRendering.ts";
import { REFERENCED_DOCUMENT, SECTIONED_DOCUMENT, SECTIONED_TITLE, WHOLE_DOCUMENT } from "#test/longReportFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { DocumentView } from "./View.ts";

expectNoReactWarnings();

const sectionedAndWhole = componentScreen(
	<>
		<DocumentView document={documentData(SECTIONED_DOCUMENT)} />
		<DocumentView document={documentData(WHOLE_DOCUMENT)} />
	</>,
);

screenStory.it(
	"a long document rendered section by section matches one render of the whole document",
	[sectionedAndWhole],
	function* ({ documentsShow, sectionedBesideWhole }) {
		yield* documentsShow("#heading-repeat-2");

		const { sectioned, whole } = yield* sectionedBesideWhole();

		expect(sectioned).toEqual(whole);
	},
);

screenStory.it(
	"headings inside a comment or a fence stay text, and a heading inside a details block stays in the block, when a document is sectioned",
	[sectionedAndWhole],
	function* ({ documentStructure, documentsShow }) {
		yield* documentsShow("#heading-repeat-2");

		expect(yield* documentStructure(0)).toEqual({ headingsInDetails: ["Inside the details"], titles: [SECTIONED_TITLE] });
	},
);

screenStory.it(
	"a reference link and a footnote defined at the end of a long document resolve where they are used",
	[componentScreen(<DocumentView document={documentData(REFERENCED_DOCUMENT)} />)],
	function* ({ documentsShow, footnotes, linkTargets }) {
		yield* documentsShow("section.footnotes");

		yield* outcomes({
			footnotes: [footnotes(), [{ note: expect.stringContaining("Read the source."), target: "#user-content-fn-source" }]],
			"guide link": [linkTargets("the guide"), ["/nested/guide.md"]],
		});
	},
);
