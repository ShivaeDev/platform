import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { diagram } from "#test/diagram.ts";
import { diagramPlan } from "#test/diagramPlans.ts";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

const EVIDENCE = "\n<details><summary>Evidence</summary>Kept.</details>\n";

screenStory.it(
	"a diagram keeps its place with its source hidden until Mermaid finishes, then shows the drawing",
	diagramPlan(diagram("Pending-->Done")),
	function* ({ diagramFigures, mermaidDraws, mermaidIsAskedToDraw }) {
		yield* mermaidIsAskedToDraw("Pending-->Done");
		expect(yield* diagramFigures()).toEqual([{ drawing: "none", source: "hidden", state: "pending" }]);

		yield* mermaidDraws("Pending-->Done");

		expect(yield* diagramFigures()).toEqual([{ drawing: "Pending-->Done in light", source: "hidden", state: "drawn" }]);
	},
);

for (const [edit, after, stable] of [
	["a paragraph is added before it", "Added first.\n\nBefore.", "Stable-->Added"],
	["the paragraph before it is edited", "Before, edited.", "Stable-->Edited"],
] as const) {
	screenStory.it(
		`a drawn diagram is not redrawn and an open section stays open when ${edit}`,
		diagramPlan(`\n\nBefore.${diagram(stable)}${EVIDENCE}`),
		function* ({
			diagramFigures,
			documentParagraphs,
			drawingRequests,
			mermaidDraws,
			mermaidIsAskedToDraw,
			openSection,
			openSections,
			rewriteDocument,
		}) {
			yield* mermaidIsAskedToDraw(stable);
			yield* mermaidDraws(stable);
			yield* openSection("Evidence");

			yield* rewriteDocument("notes/plan.md", `# Plan\n\n${after}${diagram(stable)}${EVIDENCE}`);

			yield* outcomes({
				diagrams: [diagramFigures(), [{ drawing: `${stable} in light`, source: "hidden", state: "drawn" }]],
				"Mermaid requests": [drawingRequests(), [`${stable} in light`]],
				"open sections": [openSections(), ["Evidence"]],
				paragraphs: [documentParagraphs(), after.split("\n\n")],
			});
		},
	);
}

screenStory.it(
	"an edited diagram keeps its previous drawing until Mermaid draws the new source",
	diagramPlan(diagram("Edit-->Old")),
	function* ({ diagramFigures, mermaidDraws, mermaidIsAskedToDraw, rewriteDocument }) {
		yield* mermaidIsAskedToDraw("Edit-->Old");
		yield* mermaidDraws("Edit-->Old");

		yield* rewriteDocument("notes/plan.md", `# Plan${diagram("Edit-->New")}`);

		yield* mermaidIsAskedToDraw("Edit-->New");
		expect(yield* diagramFigures()).toEqual([{ drawing: "Edit-->Old in light", source: "hidden", state: "redrawing" }]);

		yield* mermaidDraws("Edit-->New");

		expect(yield* diagramFigures()).toEqual([{ drawing: "Edit-->New in light", source: "hidden", state: "drawn" }]);
	},
);

screenStory.it(
	"a newly added diagram keeps its place with its source hidden while Mermaid draws it",
	diagramPlan(diagram("First-->Ready")),
	function* ({ diagramFigures, mermaidDraws, mermaidIsAskedToDraw, rewriteDocument }) {
		yield* mermaidIsAskedToDraw("First-->Ready");
		yield* mermaidDraws("First-->Ready");

		yield* rewriteDocument("notes/plan.md", `# Plan${diagram("First-->Ready")}${diagram("New-->Pending")}`);

		yield* mermaidIsAskedToDraw("New-->Pending");
		expect(yield* diagramFigures()).toEqual([
			{ drawing: "First-->Ready in light", source: "hidden", state: "drawn" },
			{ drawing: "none", source: "hidden", state: "pending" },
		]);
	},
);

screenStory.it(
	"an edited diagram that Mermaid cannot draw drops its previous drawing and shows its source and the error",
	diagramPlan(diagram("Valid-->Drawing")),
	function* ({ diagramFigures, mermaidDraws, mermaidFails, mermaidIsAskedToDraw, rewriteDocument }) {
		yield* mermaidIsAskedToDraw("Valid-->Drawing");
		yield* mermaidDraws("Valid-->Drawing");
		yield* rewriteDocument("notes/plan.md", `# Plan${diagram("broken")}`);
		yield* mermaidIsAskedToDraw("broken");

		yield* mermaidFails("broken", "Parse error in the diagram");

		expect(yield* diagramFigures()).toEqual([
			{ drawing: "none", error: "Diagram could not be drawn: Parse error in the diagram", source: "broken", state: "failed" },
		]);
	},
);

screenStory.it(
	"a diagram edited back to its earlier source is drawn again while the edited drawing stays in place",
	diagramPlan(diagram("Return-->Original")),
	function* ({ diagramFigures, mermaidDraws, mermaidIsAskedToDraw, rewriteDocument }) {
		yield* mermaidIsAskedToDraw("Return-->Original");
		yield* mermaidDraws("Return-->Original");
		yield* rewriteDocument("notes/plan.md", `# Plan${diagram("Return-->Edited")}`);
		yield* mermaidIsAskedToDraw("Return-->Edited");
		yield* mermaidDraws("Return-->Edited");

		yield* rewriteDocument("notes/plan.md", `# Plan${diagram("Return-->Original")}`);

		yield* mermaidIsAskedToDraw("Return-->Original");
		expect(yield* diagramFigures()).toEqual([{ drawing: "Return-->Edited in light", source: "hidden", state: "redrawing" }]);
	},
);
