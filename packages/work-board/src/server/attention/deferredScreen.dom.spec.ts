import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const PLANNED =
	'---\nid: goal.admin\nkind: project\nstatus: planned\nowner: Casey\nnext_action: "Later: design the admin system"\n---\n# Admin system\n';
screenStory.it(
	"moves deferred person-owned work out of Needs you into collapsed Later",
	[routedScreen({ "goals/admin.md": PLANNED, "home.md": "# Home" }, "/")],
	function* ({ editFile, refreshToday, refreshDocument, readText, findElement }) {
		yield* Effect.promise(() =>
			eventually(() => expect(readText('ul[aria-label="Needs you"]')).toContain("Casey notes: Later: design the admin system")),
		);
		expect(findElement("#later")).toBeNull();
		editFile("goals/admin.md", PLANNED.replace("status: planned", "status: deferred"));
		yield* Effect.promise(() => refreshToday());
		yield* Effect.promise(() => refreshDocument());
		yield* Effect.promise(() => eventually(() => expect(readText("#later")).toContain("Later: design the admin system")));
		expect(readText('ul[aria-label="Needs you"]') ?? "").not.toContain("Admin system");
		expect(readText("#inbox-count")).toBe("0");
		expect(readText("#later summary")).toBe("Later1");
		expect(findElement("#later details")).toHaveProperty("open", false);
	},
);

for (const status of ["dropped", "superseded"]) {
	screenStory.it(
		`moves ${status} person-owned work out of Needs you and every needs-you count`,
		[routedScreen({ "goals/admin.md": PLANNED, "home.md": "# Home" }, "/")],
		function* ({ editFile, refreshToday, refreshDocument, readText, findElement, findElements }) {
			yield* Effect.promise(() => eventually(() => expect(readText("#inbox-count")).toBe("1")));
			function waiting() {
				return findElements("[data-attention-id]").map((row) => row.getAttribute("data-attention-id"));
			}
			expect(waiting()).toEqual(["goal.admin"]);
			editFile("goals/admin.md", PLANNED.replace("status: planned", `status: ${status}`));
			yield* Effect.promise(() => refreshToday());
			yield* Effect.promise(() => refreshDocument());
			yield* Effect.promise(() => eventually(() => expect(readText("#inbox-count")).toBe("0")));
			expect(waiting()).toEqual([]);
			expect(readText(".today-strip a")).toBe("0 need you");
			expect(findElement("#later")).toBeNull();
		},
	);
}

const ACTIVE = "---\nid: goal.launch\nkind: project\nstatus: active\nowner: agent\nnext_action: Ship the launch\n---\n# Launch\n";
screenStory.it(
	"keeps a deferred goal out of active goals on Today, the sidebar and Goals while Later lists it",
	[routedScreen({ "goals/admin.md": PLANNED.replace("status: planned", "status: deferred"), "goals/launch.md": ACTIVE, "home.md": "# Home" }, "/")],
	function* ({ findElements, navigate, readText }) {
		function todayGoals() {
			return findElements("#today-goals [data-goal-id]").map((card) => card.getAttribute("data-goal-id"));
		}
		yield* Effect.promise(() => eventually(() => expect(todayGoals()).toEqual(["goal.launch"])));
		expect(readText(".today-strip")).toContain("1 active goal");
		expect(readText(".today-strip")).not.toContain("1 active goals");
		expect(readText("#later")).toContain("Later: design the admin system");
		yield* Effect.promise(() => eventually(() => expect(readText('section[aria-label="Active goals"]')).toContain("Launch")));
		expect(readText('section[aria-label="Active goals"]')).not.toContain("Admin system");
		yield* Effect.promise(() => navigate("/_board/goals"));
		yield* Effect.promise(() => eventually(() => expect(readText("[data-page-summary]")).toBe("1 active goal")));
		expect(readText("details summary")).toBe("Deferred goals");
		expect(findElements("details [data-goal-id]").map((card) => card.getAttribute("data-goal-id"))).toEqual(["goal.admin"]);
	},
);
