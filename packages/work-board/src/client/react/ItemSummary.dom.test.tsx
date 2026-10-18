import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/testing.ts";
import type { Document } from "#browser/document/schema.ts";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen, routedScreen } from "#test/screenTraits.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { ItemSummary } from "./ItemSummary.tsx";

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
		function* ({ routed }) {
			const view = routed();

			yield* Effect.promise(() => eventually(() => expect(view.container.querySelector(".item-summary")).not.toBeNull()));
			expect(view.container.querySelector('.item-summary [data-status-token="needs-you"]') !== null).toBe(status === "open");
			expect(view.container.querySelector(".answer-cards") !== null).toBe(status === "open");
			expect(view.container.querySelector(".item-summary [data-status-token]")?.textContent).toBe(status === "open" ? "needs-you" : status);
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
				</FleetItemsContext.Provider>,
			),
		],
		({ screen }) => {
			const view = screen();

			const header = view.container.querySelector(".item-summary");
			expect(header?.textContent).toContain("Owner: reader · Next action: Review the proof");
			expect(header?.querySelector("[data-status-token]")?.textContent).toBe("active");
			expect(header?.querySelector("svg.lucide-clipboard-list")).not.toBeNull();
			expect(header?.querySelector("button")?.textContent).toBe("Save favorite");
			expect(header?.querySelector('a[href^="/_board/handoff"]')).not.toBeNull();
			expect(header?.textContent?.includes("Fleet · reviewing")).toBe(value === fleet);
			expect(header?.querySelector('a[href="https://github.com/example/project/pull/1"]') !== null).toBe(value === fleet);
		},
	);
}

for (const kind of ["goal", "report"] as const) {
	screenStory.it(
		`shows the recorded ${kind} kind and its icon`,
		[componentScreen(<ItemSummary document={{ ...document, metadata: { ...document.metadata, kind } }} />)],
		({ screen }) => {
			const view = screen();

			expect(view.container.querySelector(".item-summary")?.textContent).toContain(kind);
			expect(view.container.querySelector(kind === "goal" ? "svg.lucide-flag" : "svg.lucide-file-text")).not.toBeNull();
		},
	);
}
