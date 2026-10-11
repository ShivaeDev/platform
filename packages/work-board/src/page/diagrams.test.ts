import { Effect, Layer } from "effect";
import { afterEach, describe, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { held, type OpenPage, openPage } from "#test/browser.ts";
import { FILES, MIXED, openLive, paragraphOf, settle, WITH_DIAGRAM, waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

const setupBoard = Effect.gen(function* () {
	notes = folder(FILES);
	board = yield* startBoard(notes.root, "board.md");
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

afterEach(() => {
	notes.remove();
});

const open = Effect.fn("Test.open")(function* (path: string, beforeScripts?: Parameters<typeof openPage>[2]) {
	page = yield* openLive(board, path, beforeScripts);
	return page;
});

function paragraph(text: string) {
	return paragraphOf(page, text);
}

function figure() {
	return page.document.querySelector("figure.diagram");
}

function sourceDisplay() {
	const source = page.document.querySelector(".diagram-source");
	return source === null ? "missing" : page.window.getComputedStyle(source).display;
}

describe("diagrams", () => {
	effectApp("loads Mermaid only on a page with a diagram", function* () {
		yield* open("/plan.md");
		expect(page.mermaidRequests).toEqual([]);
		yield* Effect.promise(() => page.close());
		yield* open("/flow.md");
		yield* Effect.promise(() => waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("drawn")));
		expect(page.mermaidRequests).toEqual([`${board.url}/_board/mermaid/mermaid.esm.min.mjs`]);
		expect(page.mermaid.configs.at(-1)).toMatchObject({ securityLevel: "strict", suppressErrorRendering: true });
	});

	effectApp("reserves space and hides a diagram's source until it is drawn", function* () {
		const drawing = held();
		page = yield* openPage(board, "/flow.md", (_window, mermaid) => {
			mermaid.gate = drawing.gate;
		});
		yield* Effect.promise(() => waitFor(() => expect(page.mermaid.calls).toHaveLength(1)));
		expect(figure()?.getAttribute("data-state")).toBe("pending");
		expect(sourceDisplay()).toBe("none");
		expect(page.window.getComputedStyle(figure() ?? page.document.body).minHeight).toBe("192px");
		drawing.release();
		yield* Effect.promise(() => waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("drawn")));
		expect(figure()?.querySelector("svg")?.getAttribute("data-source")).toBe(encodeURIComponent("graph TD; A-->B"));
		expect(sourceDisplay()).toBe("none");
	});

	effectApp("keeps a drawn diagram in place when the page around it changes", function* () {
		yield* open("/flow.md");
		yield* Effect.promise(() => waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("drawn")));
		page.mermaid.gate = held().gate;
		notes.write("flow.md", WITH_DIAGRAM.replace("After.", "After, edited.\n\nOne more line."));
		yield* Effect.promise(() => waitFor(() => expect(paragraph("One more line.")).toBeDefined()));
		yield* Effect.promise(() => waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("drawn")));
		expect(page.mermaid.calls).toHaveLength(1);
		expect(sourceDisplay()).toBe("none");
	});

	effectApp("keeps unchanged blocks, a drawn diagram and an open details block, when a paragraph is added above them", function* () {
		yield* open("/mixed.md");
		yield* Effect.promise(() => waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("drawn")));
		const drawn = figure();
		const details = page.document.querySelector("#doc details");
		details?.setAttribute("open", "");
		notes.write("mixed.md", MIXED.replace("Before.", "Added first.\n\nBefore."));
		yield* Effect.promise(() => waitFor(() => expect(paragraph("Added first.")).toBeDefined()));
		expect(figure()).toBe(drawn);
		expect(figure()?.getAttribute("data-state")).toBe("drawn");
		expect(page.document.querySelector("#doc details")).toBe(details);
		expect(details?.hasAttribute("open")).toBe(true);
		notes.write("mixed.md", MIXED.replace("Before.\n\n", ""));
		yield* Effect.promise(() => waitFor(() => expect(paragraph("Before.")).toBeUndefined()));
		expect(figure()).toBe(drawn);
		expect(page.document.querySelector("#doc details")).toBe(details);
		expect(page.mermaid.calls).toHaveLength(1);
	});

	effectApp("keeps showing an edited diagram's old drawing until the new one is ready", function* () {
		yield* open("/flow.md");
		yield* Effect.promise(() => waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("drawn")));
		const drawing = held();
		page.mermaid.gate = drawing.gate;
		notes.write("flow.md", WITH_DIAGRAM.replace("A-->B", "A-->C"));
		yield* Effect.promise(() => waitFor(() => expect(page.mermaid.calls).toHaveLength(2)));
		expect(figure()?.getAttribute("data-state")).toBe("redrawing");
		expect(figure()?.querySelector("svg")?.getAttribute("data-source")).toBe(encodeURIComponent("graph TD; A-->B"));
		expect(sourceDisplay()).toBe("none");
		drawing.release();
		yield* Effect.promise(() =>
			waitFor(() => expect(figure()?.querySelector("svg")?.getAttribute("data-source")).toBe(encodeURIComponent("graph TD; A-->C"))),
		);
		expect(figure()?.querySelectorAll("svg")).toHaveLength(1);
		expect(sourceDisplay()).toBe("none");
	});

	effectApp("shows a new diagram's reserved space, never its source, while it is drawn", function* () {
		yield* open("/flow.md");
		yield* Effect.promise(() => waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("drawn")));
		page.mermaid.gate = held().gate;
		notes.write("flow.md", `${WITH_DIAGRAM}\n\n\`\`\`mermaid\ngraph TD; X-->Y\n\`\`\`\n`);
		yield* Effect.promise(() => waitFor(() => expect(page.mermaid.calls).toHaveLength(2)));
		const added = page.document.querySelectorAll("figure.diagram")[1];
		expect(added?.getAttribute("data-state")).toBe("pending");
		expect(added?.querySelector("svg")).toBeNull();
		expect(page.window.getComputedStyle(added?.querySelector(".diagram-source") ?? page.document.body).display).toBe("none");
	});

	effectApp("shows a diagram's source and the error when it does not parse", function* () {
		notes.write("flow.md", WITH_DIAGRAM.replace("A-->B", "broken"));
		yield* open("/flow.md");
		yield* Effect.promise(() => waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("failed")));
		expect(figure()?.getAttribute("data-error")).toBe("Parse error in the diagram");
		expect(sourceDisplay()).toBe("block");
	});

	effectApp("drops the old drawing when an edited diagram no longer parses", function* () {
		yield* open("/flow.md");
		yield* Effect.promise(() => waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("drawn")));
		notes.write("flow.md", WITH_DIAGRAM.replace("A-->B", "broken"));
		yield* Effect.promise(() => waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("failed")));
		expect(figure()?.querySelector("svg")).toBeNull();
		expect(sourceDisplay()).toBe("block");
	});

	effectApp("forgets drawings of diagrams that are no longer on the page", function* () {
		yield* open("/flow.md");
		yield* Effect.promise(() => waitFor(() => expect(figure()?.getAttribute("data-state")).toBe("drawn")));
		notes.write("flow.md", WITH_DIAGRAM.replace("A-->B", "A-->C"));
		yield* Effect.promise(() =>
			waitFor(() => expect(figure()?.querySelector("svg")?.getAttribute("data-source")).toBe(encodeURIComponent("graph TD; A-->C"))),
		);
		notes.write("flow.md", WITH_DIAGRAM);
		yield* Effect.promise(() =>
			waitFor(() => expect(figure()?.querySelector("svg")?.getAttribute("data-source")).toBe(encodeURIComponent("graph TD; A-->B"))),
		);
		expect(page.mermaid.calls.map((call) => call.trim())).toEqual(["graph TD; A-->B", "graph TD; A-->C", "graph TD; A-->B"]);
	});

	effectApp("never lets a drawing for the previous colour scheme replace one for the current scheme", function* () {
		const light = held();
		page = yield* openPage(board, "/flow.md", (_window, mermaid) => {
			mermaid.gate = light.gate;
		});
		yield* Effect.promise(() => waitFor(() => expect(page.mermaid.calls).toHaveLength(1)));
		const darkDrawing = held();
		page.mermaid.gate = darkDrawing.gate;
		page.prefer("dark");
		yield* Effect.promise(() => waitFor(() => expect(page.mermaid.calls).toHaveLength(2)));
		darkDrawing.release();
		yield* Effect.promise(() => waitFor(() => expect(figure()?.querySelector("svg")?.getAttribute("data-dark")).toBe("true")));
		light.release();
		yield* Effect.promise(() => settle());
		expect(figure()?.querySelector("svg")?.getAttribute("data-dark")).toBe("true");
		expect(figure()?.querySelectorAll("svg")).toHaveLength(1);
	});

	effectApp("redraws diagrams for a new colour scheme, keeping the old drawing until the new one is ready", function* () {
		yield* open("/flow.md");
		yield* Effect.promise(() => waitFor(() => expect(figure()?.querySelector("svg")?.getAttribute("data-dark")).toBe("false")));
		const drawing = held();
		page.mermaid.gate = drawing.gate;
		page.prefer("dark");
		yield* Effect.promise(() => waitFor(() => expect(page.mermaid.calls).toHaveLength(2)));
		expect(figure()?.querySelector("svg")?.getAttribute("data-dark")).toBe("false");
		drawing.release();
		yield* Effect.promise(() => waitFor(() => expect(figure()?.querySelector("svg")?.getAttribute("data-dark")).toBe("true")));
		expect(figure()?.querySelectorAll("svg")).toHaveLength(1);
	});
});
