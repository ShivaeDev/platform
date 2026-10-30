import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { diagram } from "#test/diagram.ts";
import { documentData } from "#test/documentRendering.ts";
import { gatedDiagrams } from "#test/screenDiagrams.ts";
import { screenStory } from "#test/screenStory.ts";
import { documentScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"reserves space and hides source until Mermaid finishes",
	[gatedDiagrams(), documentScreen(documentData(diagram("Pending-->Done")))],
	function* ({ drawings, finishDiagram, findElement, readAttribute }) {
		yield* eventually(() => expect(drawings().map((drawing) => drawing.source.trim())).toEqual(["graph TD; Pending-->Done"]));
		expect(readAttribute("figure.diagram", "data-state")).toBe("pending");
		expect(findElement(".diagram-source")).toHaveProperty("hidden", true);
		expect(findElement("svg")).toBeNull();
		yield* Effect.promise(() => finishDiagram(0));
		expect(readAttribute("figure.diagram", "data-state")).toBe("drawn");
		expect(readAttribute("figure svg", "data-source")).toBe(encodeURIComponent("graph TD; Pending-->Done"));
		expect(findElement(".diagram-source")).toHaveProperty("hidden", true);
	},
);

screenStory.it(
	"keeps a drawing and open details while surrounding paragraphs change",
	[gatedDiagrams(), documentScreen(documentData(`Before.${diagram("Stable-->Drawing")}\n<details><summary>Evidence</summary>Kept.</details>\n`))],
	function* ({ drawings, finishDiagram, refreshDocumentSource, openDetails, findElement, readText }) {
		yield* eventually(() => expect(drawings().map((drawing) => drawing.source.trim())).toEqual(["graph TD; Stable-->Drawing"]));
		yield* Effect.promise(() => finishDiagram(0));
		const figure = findElement("figure");
		const details = findElement("details");
		openDetails("details");
		for (const paragraph of ["Added first.\n\nBefore.", "After, edited."]) {
			yield* Effect.promise(() =>
				refreshDocumentSource(documentData(`${paragraph}${diagram("Stable-->Drawing")}\n<details><summary>Evidence</summary>Kept.</details>\n`)),
			);
			expect(readText()).toContain(paragraph.replace("\n\n", "\n"));
			expect(findElement("figure")).toBe(figure);
			expect(findElement("details")).toBe(details);
			expect(details).toHaveProperty("open", true);
			expect(drawings().map((drawing) => drawing.source.trim())).toEqual(["graph TD; Stable-->Drawing"]);
		}
	},
);

screenStory.it(
	"keeps an edited diagram's drawing until its replacement is ready",
	[gatedDiagrams(), documentScreen(documentData(diagram("Edit-->Old")))],
	function* ({ drawings, finishDiagram, refreshDocumentSource, findElement, readAttribute }) {
		yield* eventually(() => expect(drawings().map((drawing) => drawing.source.trim())).toEqual(["graph TD; Edit-->Old"]));
		yield* Effect.promise(() => finishDiagram(0));
		yield* Effect.promise(() => refreshDocumentSource(documentData(diagram("Edit-->New"))));
		yield* eventually(() => expect(drawings().map((drawing) => drawing.source.trim())).toEqual(["graph TD; Edit-->Old", "graph TD; Edit-->New"]));
		expect(readAttribute("figure", "data-state")).toBe("redrawing");
		expect(readAttribute("figure svg", "data-source")).toBe(encodeURIComponent("graph TD; Edit-->Old"));
		expect(findElement(".diagram-source")).toHaveProperty("hidden", true);
		yield* Effect.promise(() => finishDiagram(1));
		expect(readAttribute("figure svg", "data-source")).toBe(encodeURIComponent("graph TD; Edit-->New"));
	},
);

screenStory.it(
	"reserves space for a newly inserted diagram without exposing source",
	[gatedDiagrams(), documentScreen(documentData(diagram("First-->Ready")))],
	function* ({ drawings, finishDiagram, refreshDocumentSource, findElements }) {
		yield* eventually(() => expect(drawings().map((drawing) => drawing.source.trim())).toEqual(["graph TD; First-->Ready"]));
		yield* Effect.promise(() => finishDiagram(0));
		yield* Effect.promise(() => refreshDocumentSource(documentData(diagram("First-->Ready") + diagram("New-->Pending"))));
		yield* eventually(() =>
			expect(drawings().map((drawing) => drawing.source.trim())).toEqual(["graph TD; First-->Ready", "graph TD; New-->Pending"]),
		);
		const added = findElements("figure")[1];
		expect(added?.getAttribute("data-state")).toBe("pending");
		expect(added?.querySelector("svg")).toBeNull();
		expect(added?.querySelector("pre")).toHaveProperty("hidden", true);
	},
);

screenStory.it(
	"drops the previous SVG and exposes source when the edited diagram fails",
	[gatedDiagrams(), documentScreen(documentData(diagram("Valid-->Drawing")))],
	function* ({ drawings, finishDiagram, refreshDocumentSource, findElement, readText, readAttribute }) {
		yield* eventually(() => expect(drawings().map((drawing) => drawing.source.trim())).toEqual(["graph TD; Valid-->Drawing"]));
		yield* Effect.promise(() => finishDiagram(0));
		yield* Effect.promise(() => refreshDocumentSource(documentData(diagram("broken"))));
		yield* eventually(() => expect(drawings().map((drawing) => drawing.source.trim())).toEqual(["graph TD; Valid-->Drawing", "graph TD; broken"]));
		yield* Effect.promise(() => finishDiagram(1, "Parse error in the diagram"));
		expect(readAttribute("figure", "data-state")).toBe("failed");
		expect(findElement("svg")).toBeNull();
		expect(findElement("pre")).toHaveProperty("hidden", false);
		expect(readText("pre")).toContain("broken");
		expect(readText("[role=status]")).toContain("Parse error in the diagram");
	},
);

screenStory.it(
	"forgets the replaced source drawing before that source returns",
	[gatedDiagrams(), documentScreen(documentData(diagram("Return-->Original")))],
	function* ({ drawings, finishDiagram, refreshDocumentSource, readAttribute }) {
		yield* eventually(() => expect(drawings().map((drawing) => drawing.source.trim())).toEqual(["graph TD; Return-->Original"]));
		yield* Effect.promise(() => finishDiagram(0));
		for (const [index, source] of ["Return-->Edited", "Return-->Original"].entries()) {
			yield* Effect.promise(() => refreshDocumentSource(documentData(diagram(source))));
			yield* eventually(() => expect(drawings()).toHaveLength(index + 2));
			yield* Effect.promise(() => finishDiagram(index + 1));
			expect(readAttribute("figure svg", "data-source")).toBe(encodeURIComponent(`graph TD; ${source}`));
		}
	},
);
