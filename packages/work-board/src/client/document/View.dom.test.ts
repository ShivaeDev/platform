import { Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { documentHeadings } from "#render/documentHeadings.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import { renderMarkdown } from "#server/render/markdown.ts";
import { documentData, settledDocument } from "#test/documentRendering.ts";
import { documentSource } from "#test/documentSource.ts";
import { mermaidEngine as engine } from "#test/mermaidEngine.ts";
import { questionnaireSource } from "#test/questionnaire.ts";
import { screenStory } from "#test/screenStory.ts";
import { semanticElement } from "#test/semanticElement.ts";

expectNoReactWarnings();
screenStory.it(
	"renders Board document fixtures with GFM, footnotes, directives, query links, HTML and a Mermaid code override",
	[],
	function* ({ mountDocument }) {
		const questionActions = {
			"/checks": "/_board/item/investigation.choices/#answer-card-direction",
			"/display": "/_board/item/investigation.choices/#answer-card-direction",
		};
		const { container } = yield* Effect.promise(() => mountDocument({ ...documentData(documentSource), questionActions }, "reading-"));
		yield* Effect.promise(() => settledDocument(() => expect(container.querySelector(".diagram")?.getAttribute("data-state")).toBe("drawn")));
		expect(container.querySelector("h1")?.id).toBe("heading-reading-experience");
		expect(container.querySelector("h1 .heading-anchor")?.getAttribute("href")).toBe("#heading-reading-experience");
		expect(container.querySelector("th")?.textContent).toBe("Check");
		expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
		expect(container.querySelector<HTMLInputElement>("input")?.checked).toBe(true);
		expect(container.querySelector<HTMLInputElement>("input")?.disabled).toBe(true);
		expect(container.querySelector("a[data-footnote-ref]")?.getAttribute("href")).toBe("#reading-user-content-fn-source");
		expect(container.querySelector("#reading-user-content-fn-source")?.textContent).toContain("Read the source");
		expect(container.querySelectorAll(".questionnaire-question")).toHaveLength(2);
		expect(container.querySelectorAll(".questionnaire-option")).toHaveLength(4);
		expect([...container.querySelectorAll(".questionnaire-answer")].map((link) => link.getAttribute("href"))).toEqual([questionActions["/display"]]);
		expect(container.querySelector(".visual-progress progress")?.getAttribute("value")).toBe("3");
		expect(container.querySelector(".visual-metric .visual-value")?.textContent).toBe("0 documents");
		expect(container.querySelectorAll(".visual-timeline-entries li")).toHaveLength(2);
		expect(container.querySelector(".visual-callout")?.getAttribute("role")).toBe("note");
		expect(container.querySelector('a[href="/resolved-task.md"]')?.textContent).toBe("affected work");
		expect(container.querySelector("details summary")?.textContent).toBe("Steps");
		expect(container.querySelector("details li")?.textContent).toBe("Open the source.");
		expect(container.querySelector("img")?.getAttribute("src")).toBe("/_board/attachment/shots/review.png");
		expect(container.querySelector("img")?.getAttribute("loading")).toBe("lazy");
		expect(container.querySelector(".shiki")?.innerHTML).toContain("--shiki-dark:");
		expect(container.querySelector("pre figure")).toBeNull();
		expect(engine.render).toHaveBeenCalledWith(
			expect.stringMatching(/^document-diagram-/u),
			expect.stringContaining("Question --> Response --> History"),
		);
	},
);

screenStory.it("matches server Markdown output apart from query-fed links and the drawn Mermaid SVG", [], function* ({ mountDocument }) {
	const source = metadataParse(documentSource).body;
	const questionActions = {
		"/checks": "/_board/item/investigation.choices/#answer-card-direction",
		"/display": "/_board/item/investigation.choices/#answer-card-direction",
	};
	const html = yield* renderMarkdown(source, {
		file: "nested/reading.md",
		headings: documentHeadings(true),
		questionActions: new Map(Object.entries(questionActions)),
	}).pipe(Effect.provide(Highlighter.layer));
	const server = document.createElement("div");
	server.innerHTML = html;
	const input = { ...documentData(documentSource), links: {}, questionActions };
	const { container } = yield* Effect.promise(() => mountDocument(input));
	yield* Effect.promise(() => settledDocument(() => expect(container.querySelector(".diagram-svg svg")).not.toBeNull()));
	const client = container.querySelector("article");
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
		expect([...(client?.querySelectorAll(selector) ?? [])].map(semanticElement)).toEqual([...server.querySelectorAll(selector)].map(semanticElement));
	}
	expect(container.querySelector(".diagram-source")?.textContent).toBe(server.querySelector(".diagram-source")?.textContent);
});

screenStory.it("replaces rendered source without accumulating heading anchors and keeps failed diagrams readable", [], function* ({ mountDocument }) {
	const view = yield* Effect.promise(() => mountDocument(documentData(questionnaireSource)));
	yield* Effect.promise(() => settledDocument(() => expect(view.container.querySelector("h1")).not.toBeNull()));
	engine.render.mockRejectedValueOnce(new Error("Invalid diagram"));
	yield* Effect.promise(() => view.render(documentData("# Changed\n\n# Changed\n\n```mermaid\ninvalid diagram\n```")));
	yield* Effect.promise(() =>
		settledDocument(() => expect(view.container.querySelector("[data-diagram-error]")?.textContent).toContain("Invalid diagram")),
	);
	expect([...view.container.querySelectorAll("h1")].map((element) => element.id)).toEqual(["heading-changed", "heading-changed-2"]);
	expect(view.container.querySelectorAll(".heading-anchor")).toHaveLength(2);
	expect(view.container.querySelector(".diagram-source")?.textContent).toContain("invalid diagram");
});

screenStory.it(
	"retains each details block's open state when another block with the same summary is inserted before it",
	[],
	function* ({ mountDocument }) {
		const source = "# Details\n\n<details><summary>More</summary>First.</details>\n\n<details><summary>More</summary>Second.</details>\n";
		const view = yield* Effect.promise(() => mountDocument(documentData(source)));
		yield* Effect.promise(() => settledDocument(() => expect(view.container.querySelectorAll("details")).toHaveLength(2)));
		view.container.querySelectorAll("details")[1]?.setAttribute("open", "");
		const changed = source.replace("# Details", "# Details\n\n<details><summary>More</summary>Zero.</details>");
		yield* Effect.promise(() => view.render(documentData(changed)));
		yield* Effect.promise(() =>
			settledDocument(() =>
				expect([...view.container.querySelectorAll("details")].map((element) => [element.textContent, element.open])).toEqual([
					["MoreZero.", false],
					["MoreFirst.", false],
					["MoreSecond.", true],
				]),
			),
		);
	},
);
