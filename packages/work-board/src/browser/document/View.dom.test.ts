import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { metadataParse } from "#metadata/parse.ts";
import { documentHeadings } from "#render/documentHeadings.ts";
import { Highlighter } from "#render/highlighter.ts";
import { renderMarkdown } from "#render/markdown.ts";
import { documentSource } from "#test/documentSource.ts";
import { questionnaireSource } from "#test/questionnaire.ts";
import { semanticElement } from "#test/semanticElement.ts";
import type { Document } from "./schema.ts";
import { DocumentView } from "./View.ts";

const engine = vi.hoisted(() => ({
	initialize: vi.fn(),
	render: vi.fn(async () => ({ svg: '<svg role="img"><text>Question → Response → History</text></svg>' })),
}));
vi.mock("mermaid", () => ({ default: engine }));
Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
	for (const close of cleanups.splice(0).reverse()) {
		await close();
	}
	vi.restoreAllMocks();
});

function data(source: string): Document {
	const parsed = metadataParse(source);
	return {
		diagnostics: [],
		file: "nested/reading.md",
		links: { "task.md": "/resolved-task.md" },
		metadata: parsed.fields,
		modified: 0,
		references: {},
		requests: [],
		source: parsed.body,
		unavailable: [],
		writable: false,
	};
}
async function mount(document: Document, idPrefix = "") {
	const errors = vi.spyOn(console, "error");
	const container = window.document.createElement("div");
	window.document.body.append(container);
	const root = createRoot(container);
	cleanups.push(async () => {
		await act(async () => root.unmount());
		container.remove();
		expect(errors.mock.calls).toEqual([]);
	});
	async function render(next: Document) {
		await act(async () => root.render(createElement(DocumentView, { document: next, idPrefix })));
	}
	await render(document);
	return { container, render };
}
async function settled(check: () => void) {
	await vi.waitFor(
		async () => {
			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
			});
			check();
		},
		{ timeout: 10_000 },
	);
}

it("renders Board document fixtures with GFM, footnotes, directives, query links, HTML and a Mermaid code override", async () => {
	const { container } = await mount(data(documentSource), "reading-");
	await settled(() => expect(container.querySelector(".diagram")?.getAttribute("data-state")).toBe("drawn"));
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
});

it("matches server Markdown output apart from query-fed links and the drawn Mermaid SVG", async () => {
	const source = metadataParse(documentSource).body;
	const html = await Effect.runPromise(
		renderMarkdown(source, { file: "nested/reading.md", headings: documentHeadings(true) }).pipe(Effect.provide(Highlighter.layer)),
	);
	const server = document.createElement("div");
	server.innerHTML = html;
	const input = { ...data(documentSource), links: {} };
	const { container } = await mount(input);
	await settled(() => expect(container.querySelector(".diagram-svg svg")).not.toBeNull());
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

it("replaces rendered source without accumulating heading anchors and keeps failed diagrams readable", async () => {
	const view = await mount(data(questionnaireSource));
	await settled(() => expect(view.container.querySelector("h1")).not.toBeNull());
	engine.render.mockRejectedValueOnce(new Error("Invalid diagram"));
	await view.render(data("# Changed\n\n# Changed\n\n```mermaid\ninvalid diagram\n```"));
	await settled(() => expect(view.container.querySelector("[data-diagram-error]")?.textContent).toContain("Invalid diagram"));
	expect([...view.container.querySelectorAll("h1")].map((element) => element.id)).toEqual(["heading-changed", "heading-changed-2"]);
	expect(view.container.querySelectorAll(".heading-anchor")).toHaveLength(2);
	expect(view.container.querySelector(".diagram-source")?.textContent).toContain("invalid diagram");
});
