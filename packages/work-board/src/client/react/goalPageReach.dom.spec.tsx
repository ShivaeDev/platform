import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/test-story/client/react.ts";
import { goalWorkGroups } from "#browser/views/goalWorkState.ts";
import { goalFleetFixture, goalPageFixture } from "#test/goalPageFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { DocumentMain } from "./DocumentMain.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";

const PROGRESS = '[data-goal-section="progress"]';
const quiet: Readonly<Record<string, string>> = { ...goalPageFixture(), "asks.md": "# No open asks" };
const executing = goalFleetFixture("working");
const RUN_UPDATED = 4_102_444_800_000;

screenStory.it(
	"lists several open asks behind one amber control and keeps linked work in its authored state",
	[boardScreen(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />)],
	function* ({ click, findElement, findElements, readGoals, readText }) {
		yield* eventually(() => expect(findElement("[data-goal-open-asks]")).not.toBeNull());
		const goal = (yield* Effect.promise(readGoals))?.goals.find((entry) => entry.id === "project.example");
		expect(readText("[data-goal-open-asks]")).toBe("2 open asks");
		expect(findElement("[data-goal-open-asks]")?.className).toContain("text-needs-you");
		click("[data-goal-open-asks]");
		yield* eventually(() => expect(findElement("[data-goal-ask-list]", document)).not.toBeNull());
		expect([...findElements("[data-goal-ask-list] a", document)].map((link) => link.getAttribute("href"))).toEqual(goal?.asks.map((ask) => ask.href));
		expect(goal?.asks.map((ask) => ask.href)).toEqual([
			"/_board/item/decision.review/#answer-card-goal",
			"/_board/item/decision.review/#answer-card-task",
		]);
		const asked = ["task.fifth", "task.first"];
		expect(goal?.counts.blocked).toBe(asked.length);
		expect(readText(`${PROGRESS} [data-status=blocked] [data-status-token]`)).toBe("Blocked");
		expect([...findElements('[data-goal-group="Draft"] [data-goal-item]')].map((row) => row.getAttribute("data-goal-item"))).toEqual(
			expect.arrayContaining(asked),
		);
		expect([...findElements('[data-goal-item="task.first"] [data-status-token]')].map((chip) => chip.textContent)).toEqual(["Draft", "Needs you"]);
	},
);

screenStory.it(
	"keeps zero counts and closed groups quiet and counts each table group like its chip",
	[boardScreen(quiet, (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />)],
	function* ({ findElement, findElements, readAttribute, readGoals, readText }) {
		yield* eventually(() => expect(findElement('[data-goal-item="task.fifth"]')).not.toBeNull());
		const goal = (yield* Effect.promise(readGoals))?.goals.find((entry) => entry.id === "project.example");
		expect(goal?.counts).toEqual({ blocked: 0, done: 1, parked: 4, running: 0, scheduled: 0 });
		expect(findElement("[data-goal-open-asks]")).toBeNull();
		expect(findElements(`${PROGRESS} [data-status-token]`).map((chip) => chip.textContent)).toEqual(["Done", "Parked"]);
		expect(findElements(`${PROGRESS} [data-quiet-count]`).map((label) => label.textContent)).toEqual(["Running", "Blocked", "Scheduled"]);
		expect(findElement(`${PROGRESS} .text-needs-you`)).toBeNull();
		expect(Object.fromEntries(goalWorkGroups.map((group) => [group, findElements(`[data-goal-group="${group}"] [data-goal-item]`).length]))).toEqual({
			Deferred: 1,
			Done: 1,
			Draft: 3,
			Dropped: 0,
			Ready: 0,
		});
		expect(readText('[data-goal-item="task.third"] [data-status-token]')).toBe("Deferred");
		for (const group of ["Draft", "Done"]) {
			expect(readAttribute(`[data-goal-group="${group}"] [data-slot="collapsible-trigger"]`, "aria-expanded")).toBe("false");
			expect(findElement(`[data-goal-group="${group}"] [data-slot="collapsible-content"]`)?.getAttribute("hidden")).toBe("until-found");
		}
		expect(findElement("[data-criterion-work]")).toBeNull();
		expect(readText('[data-criterion="first"] [data-slot="collapsible-trigger"]')).toBe("2 linked items");
		expect(findElement('[data-criterion="first"] [data-slot="card-title"] h3')?.className).toContain("font-normal");
	},
);

screenStory.it(
	"shows who holds in-progress work and when it last changed, without adding a Tab stop to its row",
	[
		boardScreen(
			{ ...quiet, "first.md": quiet["first.md"]?.replace("kind: task", "kind: task\nowner: codex").replace("status: draft", "status: ready") ?? "" },
			(api) => (
				<FleetItemsContext.Provider
					value={{ ...executing, items: executing.items.map((run) => (run.workId === "task.first" ? { ...run, updatedAt: RUN_UPDATED } : run)) }}
				>
					<DocumentMain api={api} onPage={() => undefined} url="/goal.md" />
				</FleetItemsContext.Provider>
			),
		),
	],
	function* ({ findElement, findElements, readTabStops, readText }) {
		yield* eventually(() => expect(findElement('[data-goal-group="Ready"] [data-goal-item="task.first"]')).not.toBeNull());
		expect(readText('[data-goal-item="task.first"] [data-goal-owner]')).toBe("codex");
		expect(findElement('[data-goal-item="task.first"] [data-goal-updated] time')?.getAttribute("data-modified")).toBe(String(RUN_UPDATED));
		expect(readTabStops('[data-goal-item="task.first"]')).toEqual(findElements('[data-goal-item="task.first"] a[href]'));
	},
);
