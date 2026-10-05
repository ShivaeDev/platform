import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { held, type OpenPage, openPage } from "#test/browser.ts";
import { FILES, MIXED, openLive, paragraphOf, settle, WITH_DIAGRAM, waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

beforeEach(async () => {
	notes = folder(FILES);
	board = await startBoard(notes.root, "board.md");
});

afterEach(async () => {
	await page.close();
	await board.stop();
	notes.remove();
});

const open = async (path: string, beforeScripts?: () => Promise<void>) => {
	page = await openLive(board, path, beforeScripts);
	return page;
};

const paragraph = (text: string) => paragraphOf(page, text);
const figure = () => page.document.querySelector("figure.diagram");
const sourceDisplay = () => {
	const source = page.document.querySelector(".diagram-source");
	return source === null ? "missing" : page.window.getComputedStyle(source).display;
};

describe("diagrams", () => {
	it("loads Mermaid only on a page with a diagram", async () => {
		await open("/plan.md");
		expect(page.mermaidRequests).toEqual([]);
		await page.close();
		await open("/flow.md");
		await waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("drawn"));
		expect(page.mermaidRequests).toEqual([`${board.url}/_board/mermaid/mermaid.esm.min.mjs`]);
	});

	it("reserves space and hides a diagram's source until it is drawn", async () => {
		page = await openPage(board, "/flow.md");
		const drawing = held();
		page.mermaid.gate = drawing.gate;
		await waitFor(() => expect(page.mermaid.calls).toHaveLength(1));
		expect(figure()?.getAttribute("data-state")).toBe("pending");
		expect(sourceDisplay()).toBe("none");
		expect(page.window.getComputedStyle(figure() ?? page.document.body).minHeight).toBe("192px");
		drawing.release();
		await waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("drawn"));
		expect(figure()?.querySelector("svg")?.getAttribute("data-source")).toBe(encodeURIComponent("graph TD; A-->B"));
		expect(sourceDisplay()).toBe("none");
	});

	it("keeps a drawn diagram in place when the page around it changes", async () => {
		await open("/flow.md");
		await waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("drawn"));
		page.mermaid.gate = held().gate;
		notes.write("flow.md", WITH_DIAGRAM.replace("After.", "After, edited.\n\nOne more line."));
		await waitFor(() => expect(paragraph("One more line.")).toBeDefined());
		await waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("drawn"));
		expect(page.mermaid.calls).toHaveLength(1);
		expect(sourceDisplay()).toBe("none");
	});

	it("keeps unchanged blocks, a drawn diagram and an open details block, when a paragraph is added above them", async () => {
		await open("/mixed.md");
		await waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("drawn"));
		const drawn = figure();
		const details = page.document.querySelector("#doc details");
		details?.setAttribute("open", "");
		notes.write("mixed.md", MIXED.replace("Before.", "Added first.\n\nBefore."));
		await waitFor(() => expect(paragraph("Added first.")).toBeDefined());
		expect(figure()).toBe(drawn);
		expect(figure()?.getAttribute("data-state")).toBe("drawn");
		expect(page.document.querySelector("#doc details")).toBe(details);
		expect(details?.hasAttribute("open")).toBe(true);
		notes.write("mixed.md", MIXED.replace("Before.\n\n", ""));
		await waitFor(() => expect(paragraph("Before.")).toBeUndefined());
		expect(figure()).toBe(drawn);
		expect(page.document.querySelector("#doc details")).toBe(details);
		expect(page.mermaid.calls).toHaveLength(1);
	});

	it("keeps showing an edited diagram's old drawing until the new one is ready", async () => {
		await open("/flow.md");
		await waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("drawn"));
		const drawing = held();
		page.mermaid.gate = drawing.gate;
		notes.write("flow.md", WITH_DIAGRAM.replace("A-->B", "A-->C"));
		await waitFor(() => expect(page.mermaid.calls).toHaveLength(2));
		expect(figure()?.getAttribute("data-state")).toBe("redrawing");
		expect(figure()?.querySelector("svg")?.getAttribute("data-source")).toBe(encodeURIComponent("graph TD; A-->B"));
		expect(sourceDisplay()).toBe("none");
		drawing.release();
		await waitFor(() => expect(figure()?.querySelector("svg")?.getAttribute("data-source")).toBe(encodeURIComponent("graph TD; A-->C")));
		expect(figure()?.querySelectorAll("svg")).toHaveLength(1);
		expect(sourceDisplay()).toBe("none");
	});

	it("shows a new diagram's reserved space, never its source, while it is drawn", async () => {
		await open("/flow.md");
		await waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("drawn"));
		page.mermaid.gate = held().gate;
		notes.write("flow.md", `${WITH_DIAGRAM}\n\n\`\`\`mermaid\ngraph TD; X-->Y\n\`\`\`\n`);
		await waitFor(() => expect(page.mermaid.calls).toHaveLength(2));
		const added = page.document.querySelectorAll("figure.diagram")[1];
		expect(added?.getAttribute("data-state")).toBe("pending");
		expect(added?.querySelector("svg")).toBeNull();
		expect(page.window.getComputedStyle(added?.querySelector(".diagram-source") ?? page.document.body).display).toBe("none");
	});

	it("shows a diagram's source and the error when it does not parse", async () => {
		notes.write("flow.md", WITH_DIAGRAM.replace("A-->B", "broken"));
		await open("/flow.md");
		await waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("failed"));
		expect(figure()?.getAttribute("data-error")).toBe("Parse error in the diagram");
		expect(sourceDisplay()).toBe("block");
	});

	it("drops the old drawing when an edited diagram no longer parses", async () => {
		await open("/flow.md");
		await waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("drawn"));
		notes.write("flow.md", WITH_DIAGRAM.replace("A-->B", "broken"));
		await waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("failed"));
		expect(figure()?.querySelector("svg")).toBeNull();
		expect(sourceDisplay()).toBe("block");
	});

	it("forgets drawings of diagrams that are no longer on the page", async () => {
		await open("/flow.md");
		await waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("drawn"));
		notes.write("flow.md", WITH_DIAGRAM.replace("A-->B", "A-->C"));
		await waitFor(() => expect(figure()?.querySelector("svg")?.getAttribute("data-source")).toBe(encodeURIComponent("graph TD; A-->C")));
		notes.write("flow.md", WITH_DIAGRAM);
		await waitFor(() => expect(figure()?.querySelector("svg")?.getAttribute("data-source")).toBe(encodeURIComponent("graph TD; A-->B")));
		expect(page.mermaid.calls.map((call) => call.trim())).toEqual(["graph TD; A-->B", "graph TD; A-->C", "graph TD; A-->B"]);
	});

	it("never lets a drawing for the previous colour scheme replace one for the current scheme", async () => {
		page = await openPage(board, "/flow.md");
		const light = held();
		page.mermaid.gate = light.gate;
		await waitFor(() => expect(page.mermaid.calls).toHaveLength(1));
		const darkDrawing = held();
		page.mermaid.gate = darkDrawing.gate;
		page.prefer("dark");
		await waitFor(() => expect(page.mermaid.calls).toHaveLength(2));
		darkDrawing.release();
		await waitFor(() => expect(figure()?.querySelector("svg")?.getAttribute("data-dark")).toBe("true"));
		light.release();
		await settle();
		expect(figure()?.querySelector("svg")?.getAttribute("data-dark")).toBe("true");
		expect(figure()?.querySelectorAll("svg")).toHaveLength(1);
	});

	it("redraws diagrams for a new colour scheme, keeping the old drawing until the new one is ready", async () => {
		await open("/flow.md");
		await waitFor(() => expect(figure()?.querySelector("svg")?.getAttribute("data-dark")).toBe("false"));
		const drawing = held();
		page.mermaid.gate = drawing.gate;
		page.prefer("dark");
		await waitFor(() => expect(page.mermaid.calls).toHaveLength(2));
		expect(figure()?.querySelector("svg")?.getAttribute("data-dark")).toBe("false");
		drawing.release();
		await waitFor(() => expect(figure()?.querySelector("svg")?.getAttribute("data-dark")).toBe("true"));
		expect(figure()?.querySelectorAll("svg")).toHaveLength(1);
	});
});
