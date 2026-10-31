import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import type { Document } from "#browser/document/schema.ts";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { readingPage } from "#test/readingScreenTraits.tsx";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { ItemSummary } from "./ItemSummary.tsx";

expectNoReactWarnings();

const TASK: Document = {
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
const PR = "https://github.com/example/project/pull/1";
const REVIEWING: FleetItemsProjection = {
	completed: [],
	items: [{ document: null, prUrl: PR, stage: "reviewing", stageEnteredAt: 0, updatedAt: 0, workId: "task.fixture" }],
	state: "ready",
};

function question(status: string) {
	return `---
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
`;
}

for (const { status, chip, cards } of [
	{ cards: ["Choose a direction"], chip: "Needs you", status: "ready" },
	{ cards: [], chip: "Done", status: "done" },
]) {
	screenStory.it(
		`a ${status} question with an open decision request reads ${chip} and offers ${cards.length > 0 ? "an answer card" : "no answer card"}`,
		[readingPage({ "question.md": question(status) }, "/_board/item/question.direction/")],
		function* ({ answerCards, itemStatus }) {
			yield* outcomes([
				["answer cards", () => answerCards(), cards],
				["status", () => itemStatus(), chip],
			]);
		},
	);
}

screenStory.it(
	"an item header shows the item's owner and next action",
	[componentScreen(<ItemSummary document={TASK} />)],
	function* ({ itemFields }) {
		expect(yield* itemFields()).toBe("Owner: marvin · Next action: Review the proof");
	},
);

screenStory.it(
	"an item Fleet is reviewing shows its Fleet stage and pull request in its header",
	[
		componentScreen(
			<FleetItemsContext.Provider value={REVIEWING}>
				<ItemSummary document={TASK} />
			</FleetItemsContext.Provider>,
		),
	],
	function* ({ itemFleet }) {
		expect(yield* itemFleet()).toEqual({ pullRequest: PR, stage: "Fleet · reviewing" });
	},
);

for (const [name, fleet] of [
	["has no Fleet data", undefined],
	["is told Fleet is unavailable", { reason: "Not configured", state: "unavailable" }],
] as const) {
	screenStory.it(
		`an item header shows no Fleet stage or pull request when it ${name}`,
		[
			componentScreen(
				<FleetItemsContext.Provider value={fleet}>
					<ItemSummary document={TASK} />
				</FleetItemsContext.Provider>,
			),
		],
		function* ({ itemFleet }) {
			expect(yield* itemFleet()).toBe("none");
		},
	);
}

for (const [kind, label] of [
	["goal", "Goal"],
	["report", "Report"],
] as const) {
	screenStory.it(
		`a ${kind}'s header names its kind ${label}`,
		[componentScreen(<ItemSummary document={{ ...TASK, metadata: { ...TASK.metadata, kind } }} />)],
		function* ({ itemKind }) {
			expect(yield* itemKind()).toBe(label);
		},
	);
}
