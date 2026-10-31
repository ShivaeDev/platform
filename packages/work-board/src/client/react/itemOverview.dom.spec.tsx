import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { informingReport, itemOpened } from "#test/itemContextTraits.tsx";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

const TASK = "---\nid: task.fixture\nkind: task\ncriteria:\n  - id: proof\n    text: Visible without a click\n---\n# Readable task\n\nBody.";

const workspace = {
	"board.md": "---\nid: board.fixture\nitems: [task.fixture]\n---\n# Board",
	"goal.md": "---\nid: goal.fixture\nkind: goal\nstatus: ready\ncriteria:\n  - id: design\n    text: Design\n---\n# Ship the feature",
	"notes.md": "# Notes\n\n[Task](task.md)",
	"one.md": informingReport("report.one", "done", "One"),
	"task.md": TASK.replace("kind: task\n", "kind: task\nrelationships:\n  - kind: implements\n    target: goal.fixture#design\n"),
	"two.md": informingReport("report.two", "draft", "Two"),
};

screenStory.it("an opened item shows its criteria unfolded", [itemOpened(workspace, "/task.md")], function* ({ criterion }) {
	expect(yield* criterion("proof")).toBe("shown: proof: Visible without a click");
});

screenStory.it(
	"an item links to the goal criterion it implements, with the goal's status",
	[itemOpened(workspace, "/task.md")],
	function* ({ contextLinks }) {
		expect(yield* contextLinks("links-to", "Implements")).toEqual([
			{ href: "/_board/item/goal.fixture/#criterion-design", name: "Ship the feature", source: "goal.fixture#design", status: "Ready" },
		]);
	},
);

screenStory.it(
	"an item counts incoming links by kind and lists each report with its status and source line",
	[itemOpened(workspace, "/task.md")],
	function* ({ contextKinds, contextLinks }) {
		yield* outcomes([
			["incoming kinds", () => contextKinds("linked-from"), ["Informed by (2)", "Listed in (1)", "Markdown link (1)"]],
			[
				"informed by",
				() => contextLinks("linked-from", "Informed by"),
				[
					{ href: expect.any(String), name: "One", source: "one.md:6", status: "Done" },
					{ href: expect.any(String), name: "Two", source: "two.md:6", status: "Draft" },
				],
			],
			["markdown links", () => contextLinks("linked-from", "Markdown link"), [expect.objectContaining({ name: "Notes" })]],
		]);
	},
);

screenStory.it(
	"an item's source stays hidden until the reader opens its Source tab",
	[itemOpened(workspace, "/task.md")],
	function* ({ itemSource, openSourceTab }) {
		expect(yield* itemSource()).toBe("hidden");

		yield* openSourceTab();

		expect(yield* itemSource()).toEqual({ file: expect.stringContaining("task.md:"), source: expect.stringContaining("id: task.fixture") });
	},
);
