import { Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { documentData, settledDocument } from "#test/documentRendering.ts";
import { failingDiagrams, serverMarkup } from "#test/documentScreens.ts";
import { documentSource } from "#test/documentSource.ts";
import { mermaidEngine as engine } from "#test/mermaidEngine.ts";
import { questionnaireSource } from "#test/questionnaire.ts";
import { screenStory } from "#test/screenStory.ts";
import { documentScreen } from "#test/screenTraits.ts";
import { semanticElement } from "#test/semanticElement.ts";

expectNoReactWarnings();
const questionActions = {
	"/checks": "/_board/item/investigation.choices/#answer-card-direction",
	"/display": "/_board/item/investigation.choices/#answer-card-direction",
};
screenStory.it(
	"renders Board document fixtures with GFM, footnotes, directives, query links, HTML and a Mermaid code override",
	[documentScreen({ ...documentData(documentSource), questionActions }, "reading-")],
	function* ({ readAttribute, findElement, readText, findElements, documentView }) {
		const { container } = documentView();
		yield* Effect.promise(() => settledDocument(() => expect(readAttribute(".diagram", "data-state", container)).toBe("drawn")));
		expect(findElement("h1", container)?.id).toBe("heading-reading-experience");
		expect(readAttribute("h1 .heading-anchor", "href", container)).toBe("#heading-reading-experience");
		expect(readText("th", container)).toBe("Check");
		expect(findElements('input[type="checkbox"]', container)).toHaveLength(2);
		expect(findElement<HTMLInputElement>("input", container)?.checked).toBe(true);
		expect(findElement<HTMLInputElement>("input", container)?.disabled).toBe(true);
		expect(readAttribute("a[data-footnote-ref]", "href", container)).toBe("#reading-user-content-fn-source");
		expect(readText("#reading-user-content-fn-source", container)).toContain("Read the source");
		expect(findElements(".questionnaire-question", container)).toHaveLength(2);
		expect(findElements(".questionnaire-option", container)).toHaveLength(4);
		expect([...findElements(".questionnaire-answer", container)].map((link) => link.getAttribute("href"))).toEqual([questionActions["/display"]]);
		expect(readAttribute(".visual-progress progress", "value", container)).toBe("3");
		expect(readText(".visual-metric .visual-value", container)).toBe("0 documents");
		expect(findElements(".visual-timeline-entries li", container)).toHaveLength(2);
		expect(readAttribute(".visual-callout", "role", container)).toBe("note");
		expect(readText('a[href="/resolved-task.md"]', container)).toBe("affected work");
		expect(readText("details summary", container)).toBe("Steps");
		expect(readText("details li", container)).toBe("Open the source.");
		expect(readAttribute("img", "src", container)).toBe("/_board/attachment/shots/review.png");
		expect(readAttribute("img", "loading", container)).toBe("lazy");
		expect(findElement(".shiki", container)?.innerHTML).toContain("--shiki-dark:");
		expect(findElement("pre figure", container)).toBeNull();
		expect(engine.render).toHaveBeenCalledWith(
			expect.stringMatching(/^document-diagram-/u),
			expect.stringContaining("Question --> Response --> History"),
		);
	},
);

screenStory.it(
	"matches server Markdown output apart from query-fed links and the drawn Mermaid SVG",
	[serverMarkup(documentSource, questionActions), documentScreen({ ...documentData(documentSource), links: {}, questionActions })],
	function* ({ documentView, referenceMarkup, findElement, findElements, readText }) {
		const { container } = documentView();
		const server = referenceMarkup();
		yield* Effect.promise(() => settledDocument(() => expect(findElement(".diagram-svg svg", container)).not.toBeNull()));
		const client = findElement("article", container);
		for (const selector of [
			"h1",
			"h2",
			"table",
			"ul.contains-task-list",
			"section.footnotes",
			".questionnaire-reading",
			".visual-document",
			".visual-callout",
			"details",
			".shiki",
			"img",
		]) {
			expect([...(findElements(selector, client) ?? [])].map(semanticElement)).toEqual([...findElements(selector, server)].map(semanticElement));
		}
		expect(readText(".diagram-source", container)).toBe(readText(".diagram-source", server));
	},
);

screenStory.it(
	"replaces rendered source without accumulating heading anchors and keeps failed diagrams readable",
	[failingDiagrams(), documentScreen(documentData(questionnaireSource))],
	function* ({ findElement, readText, findElements, refreshDocumentSource }) {
		yield* Effect.promise(() => settledDocument(() => expect(findElement("h1")).not.toBeNull()));
		yield* Effect.promise(() => refreshDocumentSource(documentData("# Changed\n\n# Changed\n\n```mermaid\ninvalid diagram\n```")));
		yield* Effect.promise(() => settledDocument(() => expect(readText("[data-diagram-error]")).toContain("Invalid diagram")));
		expect([...findElements("h1")].map((element) => element.id)).toEqual(["heading-changed", "heading-changed-2"]);
		expect(findElements(".heading-anchor")).toHaveLength(2);
		expect(readText(".diagram-source")).toContain("invalid diagram");
	},
);

const SOURCE = "# Details\n\n<details><summary>More</summary>First.</details>\n\n<details><summary>More</summary>Second.</details>\n";
screenStory.it(
	"retains each details block's open state when another block with the same summary is inserted before it",
	[documentScreen(documentData(SOURCE))],
	function* ({ findElements, openDetails, refreshDocumentSource }) {
		yield* Effect.promise(() => settledDocument(() => expect(findElements("details")).toHaveLength(2)));
		openDetails(findElements("details")[1]);
		const changed = SOURCE.replace("# Details", "# Details\n\n<details><summary>More</summary>Zero.</details>");
		yield* Effect.promise(() => refreshDocumentSource(documentData(changed)));
		yield* Effect.promise(() =>
			settledDocument(() =>
				expect([...findElements("details")].map((element) => [element.textContent, element.open])).toEqual([
					["MoreZero.", false],
					["MoreFirst.", false],
					["MoreSecond.", true],
				]),
			),
		);
	},
);
