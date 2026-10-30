import { expect } from "vitest";
import { eventually } from "@shivaedev/test-story/client/react.ts";
import type { Document } from "#browser/document/schema.ts";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen, routedScreen } from "#test/screenTraits.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { ItemActions } from "./ItemActions.tsx";
import { ItemSummary } from "./ItemSummary.tsx";

const document: Document = {
	diagnostics: [],
	file: "task.md",
	identity: "task.fixture",
	links: {},
	metadata: { id: "task.fixture", kind: "task", nextAction: "Review the proof", owner: "marvin", status: "ready" },
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

for (const [status, label] of [
	["ready", "Needs you"],
	["done", "Done"],
	["done", "Done"],
]) {
	screenStory.it(
		`only marks an explicit open request actionable while its question is open (status: ${status})`,
		[
			routedScreen(
				{
					"question.md": `---
id: question.direction
kind: question
scope: task
urgency: whenever
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
			yield* eventually(() => expect(findElement(".item-summary")).not.toBeNull());
			expect(findElement('.item-summary [data-status-token="needs-you"]') !== null).toBe(status === "ready");
			expect(findElement(".answer-cards") !== null).toBe(status === "ready");
			expect(readText(".item-summary [data-status-token]")).toBe(label);
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
			expect(header?.textContent).toContain("Owner: marvin · Next action: Review the proof");
			expect(readText("[data-status-token]", header)).toBe("Ready");
			expect(findElement("svg.lucide-clipboard-list", header)).not.toBeNull();
			expect(findElement('button[aria-label="Copy item ID"]', header)).not.toBeNull();
			expect(readText('[data-slot="button"]:not([aria-label])')).toBe("Pin");
			expect(findElement('a[href^="/_board/handoff"]')).not.toBeNull();
			expect(header?.textContent?.includes("Fleet · reviewing")).toBe(value === fleet);
			expect(findElement('a[href="https://github.com/example/project/pull/1"]', header) !== null).toBe(value === fleet);
		},
	);
}

for (const [kind, label, icon] of [
	["goal", "Goal", "svg.lucide-flag"],
	["report", "Report", "svg.lucide-file-text"],
] as const) {
	screenStory.it(
		`shows the recorded ${kind} kind and its icon`,
		[componentScreen(<ItemSummary document={{ ...document, metadata: { ...document.metadata, kind } }} />)],
		({ readText, findElement }) => {
			expect(readText(".item-summary > div > span")).toBe(label);
			expect(findElement(icon)).not.toBeNull();
		},
	);
}
