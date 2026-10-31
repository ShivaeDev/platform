import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { itemOpened } from "#test/itemContextTraits.tsx";
import { projectLinksFixture, relationshipsFixture } from "#test/relationshipsFixture.ts";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

screenStory.it(
	"an item's outgoing links sit under Links to, grouped by the item's own wording",
	[itemOpened(relationshipsFixture, "/task.md")],
	function* ({ contextHeading, contextKinds, contextLinks }) {
		yield* outcomes([
			["depends on", () => contextLinks("links-to", "Depends on"), [expect.objectContaining({ name: "Base" })]],
			["heading", () => contextHeading("links-to"), "Links to"],
			["kinds", () => contextKinds("links-to"), ["Depends on", "Implements", "Informs", "Related to"]],
		]);
	},
);

screenStory.it(
	"an item's incoming links sit under Linked from, worded from the item's side",
	[itemOpened(relationshipsFixture, "/task.md")],
	function* ({ contextHeading, contextKinds, contextLinks }) {
		yield* outcomes([
			["heading", () => contextHeading("linked-from"), "Linked from"],
			["implemented by", () => contextLinks("linked-from", "Implemented by"), [expect.objectContaining({ name: "Build" })]],
			[
				"kinds",
				() => contextKinds("linked-from"),
				["Agent handoff (1)", "Implemented by (1)", "Informed by (1)", "Listed in (1)", "Needed by (1)", "Related to (1)", "Reviewed question (1)"],
			],
			["needed by", () => contextLinks("linked-from", "Needed by"), [expect.objectContaining({ name: "Later" })]],
		]);
	},
);

screenStory.it(
	"outgoing links come before a separator and incoming links after it",
	[itemOpened(relationshipsFixture, "/task.md")],
	function* ({ contextGroups }) {
		expect(yield* contextGroups()).toEqual(["links-to", "separator", "linked-from"]);
	},
);

screenStory.it(
	"a board lists its declared items under Links to",
	[itemOpened(relationshipsFixture, "/board.md")],
	function* ({ contextKinds, contextLinks }) {
		yield* outcomes([
			["items", () => contextLinks("links-to", "Board items"), [expect.objectContaining({ name: "Task" })]],
			["kinds", () => contextKinds("links-to"), ["Board items"]],
		]);
	},
);

screenStory.it(
	"a link whose target is not in the workspace is listed under its label without a link",
	[itemOpened(relationshipsFixture, "/orphan.md")],
	function* ({ contextLinks }) {
		expect(yield* contextLinks("links-to")).toEqual([{ name: "Depends on: missing.fixture (unresolved, ambiguous, or unavailable)" }]);
	},
);

screenStory.it(
	"a project leaves Implemented by out of its incoming links",
	[itemOpened(projectLinksFixture, "/project.md")],
	function* ({ contextKinds }) {
		expect(yield* contextKinds("linked-from")).toEqual(["Markdown link (1)"]);
	},
);
