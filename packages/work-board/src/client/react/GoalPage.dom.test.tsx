import { Effect } from "effect";
import type { Window } from "happy-dom";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { goalFleetFixture, goalPageFixture } from "#test/goalPageFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { screenFleet } from "#test/screenWorkspaceTraits.ts";

const LEGEND_LABELS: Readonly<Record<string, string>> = { done: "Done", "in progress": "In progress", "needs you": "Needs you", planned: "Planned" };

declare const window: Window;

for (const [stage, label, group] of [
	["executing", "Executing", "In progress"],
	["reviewing", "Reviewing", "In progress"],
	["needs-human", "Needs you", "Needs you"],
] as const) {
	const files: Record<string, string> = { ...goalPageFixture(), "asks.md": "# No open asks" };
	files["goal.md"] = (files["goal.md"] ?? "").replace(
		"owner: agent",
		"owner: agent\nattention:\n - id: direction\n   kind: decision\n   state: open\n   response_from: [maintainer]\n   reason: Review the goal\n   unblocks: [project.example]",
	);
	const fleet = goalFleetFixture(stage);
	screenStory.it(
		`renders Fleet-aware goals-query counts and a single ${stage} state`,
		[
			screenFleet({
				...fleet,
				completed: fleet.completed.map((item) => ({ ...item, document: null })),
				items: fleet.items.map((item) => ({ ...item, document: null })),
				state: "ready",
			}),
			routedScreen(files, "/_board/item/project.example/", { home: "home.md" }),
		],
		function* ({ click, readAttribute, readGoals, findElements, findElement, readText }) {
			yield* Effect.promise(() => eventually(() => expect(findElements("[data-goal-item]")).toHaveLength(5)));
			const header = findElement(".item-introduction");
			const progress = findElement('[data-goal-section="progress"]');
			const answers = findElement(".answer-cards");
			expect(header?.nextElementSibling).toBe(progress);
			expect(progress?.nextElementSibling).toBe(answers);
			expect(answers).not.toBeNull();
			expect(answers?.compareDocumentPosition(findElement("article.doc") ?? document.body)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			yield* Effect.promise(() => eventually(() => expect(findElement("[data-goal-open-asks]")).not.toBeNull()));
			const goal = (yield* Effect.promise(readGoals)).goals.find((entry) => entry.id === "project.example");
			if (!goal) {
				throw new Error("Missing fixture goal query result");
			}
			const counts = Object.fromEntries(
				[...findElements<HTMLElement>("[data-goal-counts] [data-count]")].map((segment) => [segment.dataset.status, Number(segment.dataset.count)]),
			);
			const waiting = group === "Needs you" ? 1 : 0;
			expect(goal.counts).toEqual({ done: 2, "in progress": 1 - waiting, "needs you": waiting, planned: 2 });
			expect(counts).toEqual(goal.counts);
			expect(readText('[data-goal-section="progress"]')).toContain("5 linked items");
			expect(goal.asks).toHaveLength(1);
			expect(readText("[data-goal-open-asks]")).toBe("1 open ask");
			expect(readAttribute("a[data-goal-open-asks]", "href")).toBe("/_board/item/project.example/#answer-card-direction");
			expect(findElement("[data-goal-open-asks]")?.className).toContain("text-needs-you");
			expect(progress?.textContent).not.toContain("%");
			expect(readText(".goal-page")).not.toContain("No recorded evidence naming");
			for (const [status, count] of Object.entries(counts)) {
				const legend = [...findElements("[data-goal-counts] li")].find(
					(entry) => readText("[data-status-token], [data-quiet-count]", entry) === LEGEND_LABELS[status],
				);
				expect(readText("strong", legend)).toBe(String(count));
			}
			for (const [id, expected] of [
				["first", group],
				["second", "Done"],
				["fourth", "Done"],
				["third", "Planned"],
				["fifth", "Planned"],
			]) {
				const rows = findElements(`[data-goal-item="task.${id}"]`);
				expect(rows).toHaveLength(1);
				expect(rows[0]?.closest("[data-goal-group]")?.getAttribute("data-goal-group")).toBe(expected);
				expect(findElements("[data-status-token]", rows[0])).toHaveLength(id === "fifth" ? 0 : 1);
			}
			const row = findElement('[data-goal-item="task.first"]');
			expect([...(findElements("[data-status-token]", row) ?? [])].map((chip) => chip.textContent)).toEqual([label]);
			expect(readText('[data-goal-item="task.fifth"] td')).toBe("");
			expect(readText('[data-goal-item="task.fifth"] td [data-status-token]')).toBeUndefined();
			expect(findElement('a[href="https://github.com/example/project/pull/1"]', row)).not.toBeNull();
			expect([...findElements(`[data-goal-group="${group}"] th[scope="col"]`)].map((head) => head.textContent)).toEqual(
				group === "In progress" ? ["Work", "Criteria", "State", "Owner", "Updated", "PR"] : ["Work", "Criteria", "State", "PR"],
			);
			for (const done of ["Done", "Planned"]) {
				expect([...findElements(`[data-goal-group="${done}"] th[scope="col"]`)].map((head) => head.textContent)).not.toContain("PR");
			}
			expect(findElements('[data-goal-group="Deferred"], [data-goal-group="Active"], [data-goal-group="Not recorded"]')).toHaveLength(0);
			expect(readText("#criterion-first [data-criterion-progress]")).toBe(`1 done · 1 ${group.toLowerCase()}`);
			expect(findElements("#criterion-first [data-criterion-work]")).toHaveLength(0);
			click("#criterion-first [data-slot=collapsible-trigger]");
			expect(
				[...findElements("#criterion-first [data-criterion-work] li:first-child [data-status-token]")].slice(0, 2).map((chip) => chip.textContent),
			).toEqual([label]);
			expect(findElements('#criterion-first a[href*="#recorded-evidence-"]')).toHaveLength(2);
			yield* Effect.promise(() => eventually(() => expect(readText("#criterion-second")).toBe("Second criterion")));
			expect(findElement("#criterion-second")?.closest("details, [hidden]")).toBeNull();
			expect(readAttribute('[data-goal-group="Done"] [data-slot=collapsible-trigger]', "aria-expanded")).toBe("false");
			expect(findElement("article.doc")?.firstElementChild?.className).toContain("goal-page");
			yield* Effect.promise(() =>
				eventually(() => {
					expect(findElement('.document-outline a[href="#heading-why-this-goal-matters"]')).not.toBeNull();
					expect(findElement(`.document-outline a[href="#${findElement("h2", progress)?.id}"]`)).not.toBeNull();
				}),
			);
		},
	);
}

screenStory.it(
	"leaves the PR cell empty for linked work in a group where another row has a PR",
	[
		screenFleet({
			...goalFleetFixture(),
			items: goalFleetFixture().items.map((item) => (item.workId === "task.third" ? { ...item, stage: "executing" } : item)),
		}),
		routedScreen({ ...goalPageFixture(), "asks.md": "# No open asks" }, "/_board/item/project.example/", { home: "home.md" }),
	],
	function* ({ findElement, findElements, readText }) {
		yield* Effect.promise(() =>
			eventually(() => expect(findElement('[data-goal-group="In progress"] [data-goal-item="task.third"]')).not.toBeNull()),
		);
		expect([...findElements('[data-goal-group="In progress"] th[scope="col"]')].map((head) => head.textContent)).toEqual([
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
		routedScreen({ ...goalPageFixture(), "unnamed.md": "---\nkind: project\nstatus: planned\n---\n# Unnamed goal" }, "/unnamed.md", {
			home: "home.md",
		}),
	],
	function* ({ findElement, readText }) {
		yield* Effect.promise(() =>
			eventually(() =>
				expect(readText('[data-goal-section="progress"] [role="status"]')).toBe("Progress is available for uniquely identified projects."),
			),
		);
		yield* Effect.promise(() => eventually(() => expect(readText(".goal-page")).not.toContain("Loading linked work")));
		expect(findElement('[data-goal-section="work"]')).toBeNull();
		expect(readText(".goal-page")).not.toContain("Linked work unavailable.");
	},
);
