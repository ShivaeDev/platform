import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const TWO_HOURS = 2 * 60 * 60 * 1000;

screenStory.it(
	"says how long ago a listed document changed without adding a Tab stop to its row",
	[
		routedScreen({ "home.md": "# Home", "note.md": "# Note" }, "/_board/library?view=recently-changed", {
			home: "home.md",
			modified: new Map([["note.md", Effect.runSync(Clock.currentTimeMillis) - TWO_HOURS]]),
		}),
	],
	function* ({ libraryRow }) {
		expect(yield* libraryRow("Note")).toEqual({ details: "Document", tabStops: ["Note"], updated: "Updated 2h ago" });
	},
);

const goals = { "goal.md": "---\nid: project.calm\nkind: goal\nstatus: ready\n---\n# A calm workspace\n", "note.md": "# Note" };

screenStory.it("labels a goal's Library row Goal with its status", [routedScreen(goals, "/_board/library")], function* ({ libraryRow }) {
	expect((yield* libraryRow("A calm workspace")).details).toBe("Goal · Ready");
});

screenStory.it(
	"offers goals as Goal in the Kind filter and narrows the Library to them",
	[routedScreen(goals, "/_board/library?view=titles")],
	function* ({ filterLibrary, libraryFilters, libraryTitles }) {
		expect(yield* libraryTitles()).toEqual(["A calm workspace", "Note"]);

		yield* filterLibrary("Kind", "Goal");

		yield* outcomes([
			["the filters", () => libraryFilters(), { fleet: false, kind: "Goal", query: "", reset: "offered", status: "All statuses", view: "By title" }],
			["the listed titles", () => libraryTitles(), ["A calm workspace"]],
		]);
	},
);
