import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { goalFleetFixture, goalPageFixture } from "#test/goalPageFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { screenFleet } from "#test/screenWorkspaceTraits.ts";

for (const [stage, label] of [
	["working", "Working"],
	["reviewing", "Reviewing"],
	["waiting", "Waiting"],
] as const) {
	const files: Record<string, string> = { ...goalPageFixture(), "asks.md": "# No open asks" };
	const fleet = goalFleetFixture(stage);
	screenStory.it(
		`keeps authored progress before the goal's prose while showing Fleet ${stage} separately`,
		[
			screenFleet({
				...fleet,
				completed: fleet.completed.map((item) => ({ ...item, document: null })),
				items: fleet.items.map((item) => ({ ...item, document: null })),
				state: "ready",
			}),
			routedScreen(files, "/_board/item/project.example/", { home: "home.md" }),
		],
		function* ({ readGoals, findElement, findElements, readText }) {
			yield* eventually(() => expect(findElement('[data-goal-item="task.first"]')).not.toBeNull());
			const goal = (yield* Effect.promise(readGoals)).goals.find((entry) => entry.id === "project.example");
			expect(goal?.counts).toEqual({ deferred: 1, done: 1, draft: 3, dropped: 0, ready: 0 });
			const progress = findElement('[data-goal-section="progress"]');
			expect(findElement(".item-introduction")?.nextElementSibling).toBe(progress);
			expect(readText('[data-goal-section="progress"]')).toContain("5 linked items");
			expect(
				findElements("[data-goal-counts] [data-count]").map((entry) => [entry.getAttribute("data-status"), entry.getAttribute("data-count")]),
			).toEqual([
				["done", "1"],
				["deferred", "1"],
				["ready", "0"],
				["draft", "3"],
				["dropped", "0"],
			]);
			expect(readText('[data-goal-item="task.first"] [data-status-token]')).toBe(label);
			expect(findElement('[data-goal-item="task.first"]')?.closest("[data-goal-group]")?.getAttribute("data-goal-group")).toBe("Draft");
			expect(findElement('[data-goal-item="task.third"]')?.closest("[data-goal-group]")?.getAttribute("data-goal-group")).toBe("Deferred");
			expect(findElement('[data-goal-item="task.fourth"]')?.closest("[data-goal-group]")?.getAttribute("data-goal-group")).toBe("Done");
			expect(findElement('a[href="https://github.com/example/project/pull/1"]', findElement('[data-goal-item="task.first"]'))).not.toBeNull();
			expect(readText("#criterion-first [data-criterion-progress]")).toBe("2 draft");
			expect(progress?.textContent).not.toContain("%");
			yield* eventually(() => expect(findElement('.document-outline a[href="#heading-why-this-goal-matters"]')).not.toBeNull());
		},
	);
}

screenStory.it(
	"leaves the PR cell empty for linked work in a group where another row has a PR",
	[
		screenFleet({
			...goalFleetFixture(),
			items: goalFleetFixture().items.map((item) => (item.workId === "task.third" ? { ...item, stage: "working" } : item)),
		}),
		routedScreen(
			{
				...goalPageFixture(),
				"asks.md": "# No open asks",
				"first.md": (goalPageFixture()["first.md"] ?? "").replace("status: draft", "status: ready"),
				"third.md": (goalPageFixture()["third.md"] ?? "").replace("status: deferred", "status: ready"),
			},
			"/_board/item/project.example/",
			{ home: "home.md" },
		),
	],
	function* ({ findElement, findElements, readText }) {
		yield* eventually(() => expect(findElement('[data-goal-group="Ready"] [data-goal-item="task.third"]')).not.toBeNull());
		expect([...findElements('[data-goal-group="Ready"] th[scope="col"]')].map((head) => head.textContent)).toEqual([
			"Work",
			"Criteria",
			"State",
			"Owner",
			"Updated",
			"PR",
		]);
		expect(readText('[data-goal-item="task.first"] td:last-child')).toBe("PR");
		expect(readText('[data-goal-item="task.third"] td:last-child')).toBe("");
		expect(findElement('[data-goal-item="task.third"] a[href*="/pull/"]')).toBeNull();
	},
);

screenStory.it(
	"shows no linked work for a project page without an id",
	[
		routedScreen({ ...goalPageFixture(), "unnamed.md": "---\nkind: goal\nstatus: draft\n---\n# Unnamed goal" }, "/unnamed.md", {
			home: "home.md",
		}),
	],
	function* ({ findElement, readText }) {
		yield* eventually(() =>
			expect(readText('[data-goal-section="progress"] [role="status"]')).toBe("Progress is available for uniquely identified goals."),
		);
		yield* eventually(() => expect(readText(".goal-page")).not.toContain("Loading linked work"));
		expect(findElement('[data-goal-section="work"]')).toBeNull();
		expect(readText(".goal-page")).not.toContain("Linked work unavailable.");
	},
);
