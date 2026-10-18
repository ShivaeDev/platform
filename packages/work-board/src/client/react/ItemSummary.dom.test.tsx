import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import type { Document } from "#browser/document/schema.ts";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen, routedScreen } from "#test/screenTraits.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { ItemActions, ItemSummary } from "./ItemSummary.tsx";

const document: Document = {
	diagnostics: [],
	file: "task.md",
	identity: "task.fixture",
	links: {},
	metadata: { id: "task.fixture", kind: "task", nextAction: "Review the proof", owner: "reader", status: "active" },
	modified: 0,
	questionActions: {},
	references: {},
	requests: [],
	source: "# Readable task\n\nBody.",
	unavailable: [],
	writable: false,
};
const fleet: FleetItemsProjection = {
	completed: [],
	items: [
		{
			document: null,
			prUrl: "https://github.com/example/project/pull/1",
			stage: "reviewing",
			stageEnteredAt: 0,
			updatedAt: 0,
			workId: "task.fixture",
		},
	],
	state: "ready",
};

for (const status of ["open", "closed", "done"]) {
	screenStory.it(
		`only marks an explicit open request actionable while its question is open (status: ${status})`,
		[
			routedScreen(
				{
					"question.md": `---
id: question.direction
kind: question
status: ${status}
attention:
 - id: direction
   kind: decision
   state: open
   response_from: [maintainer]
   reason: Choose a direction
   unblocks: [question.direction]
---
# Choose a direction
`,
				},
				"/_board/item/question.direction/",
			),
		],
		function* ({ findElement, readText }) {
			yield* Effect.promise(() => eventually(() => expect(findElement(".item-summary")).not.toBeNull()));
			expect(findElement('.item-summary [data-status-token="needs-you"]') !== null).toBe(status === "open");
			expect(findElement(".answer-cards") !== null).toBe(status === "open");
			expect(readText(".item-summary [data-status-token]")).toBe(status === "open" ? "needs-you" : status);
		},
	);
}

for (const [storyCase, value] of [undefined, { reason: "Not configured", state: "unavailable" } as const, fleet].entries()) {
	screenStory.it(
		`renders authored header fields with optional Fleet data (${storyCase + 1})`,
		[
			componentScreen(
				<FleetItemsContext.Provider value={value}>
					<ItemSummary document={document} />
					<ItemActions document={document} />
				</FleetItemsContext.Provider>,
			),
		],
		({ findElement, readText }) => {
			const header = findElement(".item-summary");
			expect(header?.textContent).toContain("Owner: reader · Next action: Review the proof");
			expect(readText("[data-status-token]", header)).toBe("active");
			expect(findElement("svg.lucide-clipboard-list", header)).not.toBeNull();
			expect(readText("button")).toBe("Save favorite");
			expect(findElement('a[href^="/_board/handoff"]')).not.toBeNull();
			expect(header?.textContent?.includes("Fleet · reviewing")).toBe(value === fleet);
			expect(findElement('a[href="https://github.com/example/project/pull/1"]', header) !== null).toBe(value === fleet);
		},
	);
}

for (const kind of ["goal", "report"] as const) {
	screenStory.it(
		`shows the recorded ${kind} kind and its icon`,
		[componentScreen(<ItemSummary document={{ ...document, metadata: { ...document.metadata, kind } }} />)],
		({ readText, findElement }) => {
			expect(readText(".item-summary")).toContain(kind);
			expect(findElement(kind === "goal" ? "svg.lucide-flag" : "svg.lucide-file-text")).not.toBeNull();
		},
	);
}
