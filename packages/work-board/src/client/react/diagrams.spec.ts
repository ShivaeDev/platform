import { Effect } from "effect";
import { describe, expect } from "vitest";
import { boardStory } from "#test/boardStory.ts";
import { held } from "#test/browser.ts";
import { figure, sourceDisplay } from "#test/diagramObservation.ts";
import { MIXED, paragraphOf, settle, WITH_DIAGRAM, waitFor } from "#test/live.ts";
import { samplePages } from "#test/pageTraits.ts";

describe("diagrams", () => {
	boardStory.it("loads Mermaid only on a page with a diagram", [samplePages()], function* ({ board, reader, page: initialPage }) {
		let page = initialPage;
		page = yield* reader.open("/plan.md");
		expect(page.mermaidRequests).toEqual([]);
		yield* Effect.promise(() => page.close());
		page = yield* reader.open("/flow.md");
		yield* Effect.promise(() => waitFor(() => expect(figure(page)?.getAttribute("data-state")).toBe("drawn")));
		expect(page.mermaidRequests).toEqual([`${board.url}/_board/mermaid/mermaid.esm.min.mjs`]);
		expect(page.mermaid.configs.at(-1)).toMatchObject({ securityLevel: "strict", suppressErrorRendering: true });
	});

	boardStory.it("reserves space and hides a diagram's source until it is drawn", [samplePages()], function* ({ reader, page: initialPage }) {
		let page = initialPage;
		const drawing = held();
		page = yield* reader.open("/flow.md", (_window, mermaid) => {
			mermaid.gate = drawing.gate;
		});
		yield* Effect.promise(() => waitFor(() => expect(page.mermaid.calls).toHaveLength(1)));
		expect(figure(page)?.getAttribute("data-state")).toBe("pending");
		expect(sourceDisplay(page)).toBe("none");
		drawing.release();
		yield* Effect.promise(() => waitFor(() => expect(figure(page)?.getAttribute("data-state")).toBe("drawn")));
		expect(figure(page)?.querySelector("svg")?.getAttribute("data-source")).toBe(encodeURIComponent("graph TD; A-->B"));
		expect(sourceDisplay(page)).toBe("none");
	});

	boardStory.it("keeps a drawn diagram in place when the page around it changes", [samplePages()], function* ({ notes, reader, page: initialPage }) {
		let page = initialPage;
		page = yield* reader.open("/flow.md");
		yield* Effect.promise(() => waitFor(() => expect(figure(page)?.getAttribute("data-state")).toBe("drawn")));
		page.mermaid.gate = held().gate;
		notes.write("flow.md", WITH_DIAGRAM.replace("After.", "After, edited.\n\nOne more line."));
		yield* Effect.promise(() => waitFor(() => expect(paragraphOf(page, "One more line.")).toBeDefined()));
		yield* Effect.promise(() => waitFor(() => expect(figure(page)?.getAttribute("data-state")).toBe("drawn")));
		expect(page.mermaid.calls).toHaveLength(1);
		expect(sourceDisplay(page)).toBe("none");
	});

	boardStory.it(
		"keeps unchanged blocks, a drawn diagram and an open details block, when a paragraph is added above them",
		[samplePages()],
		function* ({ notes, reader, page: initialPage }) {
			let page = initialPage;
			page = yield* reader.open("/mixed.md");
			yield* Effect.promise(() => waitFor(() => expect(figure(page)?.getAttribute("data-state")).toBe("drawn")));
			const drawn = figure(page);
			const details = page.document.querySelector("#doc details");
			details?.setAttribute("open", "");
			notes.write("mixed.md", MIXED.replace("Before.", "Added first.\n\nBefore."));
			yield* Effect.promise(() => waitFor(() => expect(paragraphOf(page, "Added first.")).toBeDefined()));
			expect(figure(page)).toBe(drawn);
			expect(figure(page)?.getAttribute("data-state")).toBe("drawn");
			expect(page.document.querySelector("#doc details")).toBe(details);
			expect(details?.hasAttribute("open")).toBe(true);
			notes.write("mixed.md", MIXED.replace("Before.\n\n", ""));
			yield* Effect.promise(() => waitFor(() => expect(paragraphOf(page, "Before.")).toBeUndefined()));
			expect(figure(page)).toBe(drawn);
			expect(page.document.querySelector("#doc details")).toBe(details);
			expect(page.mermaid.calls).toHaveLength(1);
		},
	);

	boardStory.it(
		"keeps showing an edited diagram's old drawing until the new one is ready",
		[samplePages()],
		function* ({ notes, reader, page: initialPage }) {
			let page = initialPage;
			page = yield* reader.open("/flow.md");
			yield* Effect.promise(() => waitFor(() => expect(figure(page)?.getAttribute("data-state")).toBe("drawn")));
			const drawing = held();
			page.mermaid.gate = drawing.gate;
			notes.write("flow.md", WITH_DIAGRAM.replace("A-->B", "A-->C"));
			yield* Effect.promise(() => waitFor(() => expect(page.mermaid.calls).toHaveLength(2)));
			expect(figure(page)?.getAttribute("data-state")).toBe("redrawing");
			expect(figure(page)?.querySelector("svg")?.getAttribute("data-source")).toBe(encodeURIComponent("graph TD; A-->B"));
			expect(sourceDisplay(page)).toBe("none");
			drawing.release();
			yield* Effect.promise(() =>
				waitFor(() => expect(figure(page)?.querySelector("svg")?.getAttribute("data-source")).toBe(encodeURIComponent("graph TD; A-->C"))),
			);
			expect(figure(page)?.querySelectorAll("svg")).toHaveLength(1);
			expect(sourceDisplay(page)).toBe("none");
		},
	);

	boardStory.it(
		"shows a new diagram's reserved space, never its source, while it is drawn",
		[samplePages()],
		function* ({ notes, reader, page: initialPage }) {
			let page = initialPage;
			page = yield* reader.open("/flow.md");
			yield* Effect.promise(() => waitFor(() => expect(figure(page)?.getAttribute("data-state")).toBe("drawn")));
			page.mermaid.gate = held().gate;
			notes.write("flow.md", `${WITH_DIAGRAM}\n\n\`\`\`mermaid\ngraph TD; X-->Y\n\`\`\`\n`);
			yield* Effect.promise(() => waitFor(() => expect(page.mermaid.calls).toHaveLength(2)));
			const added = page.document.querySelectorAll("figure.diagram")[1];
			expect(added?.getAttribute("data-state")).toBe("pending");
			expect(added?.querySelector("svg")).toBeNull();
			expect(added?.querySelector(".diagram-source")?.hasAttribute("hidden")).toBe(true);
		},
	);

	boardStory.it("shows a diagram's source and the error when it does not parse", [samplePages()], function* ({ notes, reader, page: initialPage }) {
		let page = initialPage;
		notes.write("flow.md", WITH_DIAGRAM.replace("A-->B", "broken"));
		page = yield* reader.open("/flow.md");
		yield* Effect.promise(() => waitFor(() => expect(figure(page)?.getAttribute("data-state")).toBe("failed")));
		expect(figure(page)?.getAttribute("data-error")).toBe("Parse error in the diagram");
		expect(sourceDisplay(page)).toBe("block");
	});

	boardStory.it("drops the old drawing when an edited diagram no longer parses", [samplePages()], function* ({ notes, reader, page: initialPage }) {
		let page = initialPage;
		page = yield* reader.open("/flow.md");
		yield* Effect.promise(() => waitFor(() => expect(figure(page)?.getAttribute("data-state")).toBe("drawn")));
		notes.write("flow.md", WITH_DIAGRAM.replace("A-->B", "broken"));
		yield* Effect.promise(() => waitFor(() => expect(figure(page)?.getAttribute("data-state")).toBe("failed")));
		expect(figure(page)?.querySelector("svg")).toBeNull();
		expect(sourceDisplay(page)).toBe("block");
	});

	boardStory.it("forgets drawings of diagrams that are no longer on the page", [samplePages()], function* ({ notes, reader, page: initialPage }) {
		let page = initialPage;
		page = yield* reader.open("/flow.md");
		yield* Effect.promise(() => waitFor(() => expect(figure(page)?.getAttribute("data-state")).toBe("drawn")));
		notes.write("flow.md", WITH_DIAGRAM.replace("A-->B", "A-->C"));
		yield* Effect.promise(() =>
			waitFor(() => expect(figure(page)?.querySelector("svg")?.getAttribute("data-source")).toBe(encodeURIComponent("graph TD; A-->C"))),
		);
		notes.write("flow.md", WITH_DIAGRAM);
		yield* Effect.promise(() =>
			waitFor(() => expect(figure(page)?.querySelector("svg")?.getAttribute("data-source")).toBe(encodeURIComponent("graph TD; A-->B"))),
		);
		expect(page.mermaid.calls.map((call) => call.trim())).toEqual(["graph TD; A-->B", "graph TD; A-->C", "graph TD; A-->B"]);
	});

	boardStory.it(
		"never lets a drawing for the previous colour scheme replace one for the current scheme",
		[samplePages()],
		function* ({ reader, page: initialPage }) {
			let page = initialPage;
			const light = held();
			page = yield* reader.open("/flow.md", (_window, mermaid) => {
				mermaid.gate = light.gate;
			});
			yield* Effect.promise(() => waitFor(() => expect(page.mermaid.calls).toHaveLength(1)));
			const darkDrawing = held();
			page.mermaid.gate = darkDrawing.gate;
			page.prefer("dark");
			yield* Effect.promise(() => waitFor(() => expect(page.mermaid.calls).toHaveLength(2)));
			darkDrawing.release();
			yield* Effect.promise(() => waitFor(() => expect(figure(page)?.querySelector("svg")?.getAttribute("data-dark")).toBe("true")));
			light.release();
			yield* Effect.promise(() => settle());
			expect(figure(page)?.querySelector("svg")?.getAttribute("data-dark")).toBe("true");
			expect(figure(page)?.querySelectorAll("svg")).toHaveLength(1);
		},
	);

	boardStory.it(
		"redraws diagrams for a new colour scheme, keeping the old drawing until the new one is ready",
		[samplePages()],
		function* ({ reader, page: initialPage }) {
			let page = initialPage;
			page = yield* reader.open("/flow.md");
			yield* Effect.promise(() => waitFor(() => expect(figure(page)?.querySelector("svg")?.getAttribute("data-dark")).toBe("false")));
			const drawing = held();
			page.mermaid.gate = drawing.gate;
			page.prefer("dark");
			yield* Effect.promise(() => waitFor(() => expect(page.mermaid.calls).toHaveLength(2)));
			expect(figure(page)?.querySelector("svg")?.getAttribute("data-dark")).toBe("false");
			drawing.release();
			yield* Effect.promise(() => waitFor(() => expect(figure(page)?.querySelector("svg")?.getAttribute("data-dark")).toBe("true")));
			expect(figure(page)?.querySelectorAll("svg")).toHaveLength(1);
		},
	);
});
