import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { goalWorkGroups } from "#browser/views/goalWorkState.ts";
import { goalFleetFixture, goalPageFixture } from "#test/goalPageFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { DocumentMain } from "./DocumentMain.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";

const PROGRESS = '[data-goal-section="progress"]';
const quiet: Readonly<Record<string, string>> = { ...goalPageFixture(), "asks.md": "# No open asks" };
const executing = goalFleetFixture("executing");
const RUN_UPDATED = 4_102_444_800_000;

screenStory.it(
	"lists several open asks behind one amber control and counts their linked work as needing you",
	[boardScreen(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />)],
	function* ({ click, findElement, findElements, readGoals, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("[data-goal-open-asks]")).not.toBeNull()));
		const goal = (yield* Effect.promise(readGoals))?.goals.find((entry) => entry.id === "project.example");
		expect(readText("[data-goal-open-asks]")).toBe("2 open asks");
		expect(findElement("[data-goal-open-asks]")?.className).toContain("text-needs-you");
		click("[data-goal-open-asks]");
		yield* Effect.promise(() => eventually(() => expect(findElement("[data-goal-ask-list]", document)).not.toBeNull()));
		expect([...findElements("[data-goal-ask-list] a", document)].map((link) => link.getAttribute("href"))).toEqual(goal?.asks.map((ask) => ask.href));
		expect(goal?.asks.map((ask) => ask.href)).toEqual([
			"/_board/item/decision.review/#answer-card-goal",
			"/_board/item/decision.review/#answer-card-task",
		]);
		const asked = ["task.fifth", "task.first"];
		expect(goal?.counts["needs you"]).toBe(asked.length);
		expect(readText(`${PROGRESS} [data-status="needs you"] [data-status-token]`)).toBe("Needs you");
		expect([...findElements('[data-goal-group="Needs you"] [data-goal-item]')].map((row) => row.getAttribute("data-goal-item"))).toEqual(asked);
		expect([...findElements('[data-goal-item="task.first"] [data-status-token]')].map((chip) => chip.textContent)).toEqual(["Planned", "Needs you"]);
	},
);

screenStory.it(
	"keeps zero counts and closed groups quiet and counts each table group like its chip",
	[boardScreen(quiet, (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />)],
	function* ({ findElement, findElements, readAttribute, readGoals, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement('[data-goal-item="task.fifth"]')).not.toBeNull()));
		const goal = (yield* Effect.promise(readGoals))?.goals.find((entry) => entry.id === "project.example");
		expect(goal?.counts).toEqual({ done: 1, "in progress": 0, "needs you": 0, planned: 4 });
		expect(findElement("[data-goal-open-asks]")).toBeNull();
		expect(findElements(`${PROGRESS} [data-status-token]`).map((chip) => chip.textContent)).toEqual(["Done", "Planned"]);
		expect(findElements(`${PROGRESS} [data-quiet-count]`).map((label) => label.textContent)).toEqual(["Needs you", "In progress"]);
		expect(findElement(`${PROGRESS} .text-needs-you`)).toBeNull();
		expect(Object.fromEntries(goalWorkGroups.map((group) => [group, findElements(`[data-goal-group="${group}"] [data-goal-item]`).length]))).toEqual({
			Done: goal?.counts.done,
			"In progress": goal?.counts["in progress"],
			"Needs you": goal?.counts["needs you"],
			Planned: goal?.counts.planned,
		});
		expect(readText('[data-goal-item="task.third"] [data-status-token]')).toBe("Deferred");
		for (const group of ["Planned", "Done"]) {
			expect(readAttribute(`[data-goal-group="${group}"] [data-slot="collapsible-trigger"]`, "aria-expanded")).toBe("false");
			expect(findElement(`[data-goal-group="${group}"] [data-slot="collapsible-content"]`)?.getAttribute("hidden")).toBe("until-found");
		}
		expect(findElement("[data-criterion-work]")).toBeNull();
		expect(readText('[data-criterion="first"] [data-slot="collapsible-trigger"]')).toBe("2 linked items");
		expect(findElement('[data-criterion="first"] [data-slot="card-title"]')?.className).toContain("font-normal");
	},
);

screenStory.it(
	"shows who holds in-progress work and when it last changed",
	[
		boardScreen({ ...quiet, "first.md": quiet["first.md"]?.replace("kind: task", "kind: task\nowner: codex") ?? "" }, (api) => (
			<FleetItemsContext.Provider
				value={{ ...executing, items: executing.items.map((run) => (run.workId === "task.first" ? { ...run, updatedAt: RUN_UPDATED } : run)) }}
			>
				<DocumentMain api={api} onPage={() => undefined} url="/goal.md" />
			</FleetItemsContext.Provider>
		)),
	],
	function* ({ findElement, readText }) {
		yield* Effect.promise(() =>
			eventually(() => expect(findElement('[data-goal-group="In progress"] [data-goal-item="task.first"]')).not.toBeNull()),
		);
		expect(readText('[data-goal-item="task.first"] [data-goal-owner]')).toBe("codex");
		expect(findElement('[data-goal-item="task.first"] [data-goal-updated] time')?.getAttribute("data-modified")).toBe(String(RUN_UPDATED));
	},
);
