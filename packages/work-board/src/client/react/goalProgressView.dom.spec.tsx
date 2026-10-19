import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { goalPageFixture } from "#test/goalPageFixture.ts";
import { screenChartLayout } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { DocumentMain } from "./DocumentMain.tsx";

const files = goalPageFixture();

screenStory.it(
	"shows goal progress on the stock progress bar and charts each state overall and per criterion under its own heading",
	[screenChartLayout(), boardScreen(files, (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />)],
	function* ({ findElement, findElements, readAttribute, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement('[data-goal-section="progress"] [data-slot="chart"]')).not.toBeNull()));
		const progress = '[data-goal-section="progress"]';
		expect(readAttribute(`${progress} [role="progressbar"]`, "aria-valuetext")).toBe("1 of 5 done");
		expect(readText(`${progress} [data-slot="progress-value"]`)).toBe("1 of 5 done");
		expect([...findElements(`${progress} [data-goal-counts] li`)].map((entry) => [entry.dataset.status, entry.dataset.count])).toEqual([
			["done", "1"],
			["needs you", "0"],
			["in progress", "0"],
			["planned", "4"],
		]);
		yield* Effect.promise(() =>
			eventually(() => {
				expect(readText(`${progress} [data-goal-breakdown] h3`)).toBe("By criterion");
				expect([...findElements(`${progress} .recharts-yAxis-tick-labels text`)].map((tick) => tick.textContent)).toEqual(["All work", "first"]);
				expect(
					[...findElements(`${progress} .recharts-bar-rectangle path`)].map((bar) => [
						bar.getAttribute("name"),
						bar.getAttribute("fill"),
						bar.getAttribute("width"),
					]),
				).toEqual([
					["All work", "var(--color-done)", "112.8"],
					["All work", "var(--color-planned)", "451.2"],
					["first", "var(--color-planned)", "564"],
				]);
				expect([...findElements(`${progress} .recharts-legend-wrapper > div > div`)].map((entry) => entry.textContent)).toEqual([
					"Done",
					"Needs you",
					"In progress",
					"Planned",
				]);
			}),
		);
	},
);

screenStory.it(
	"leaves the chart out when no criterion has linked work, since the progress bar and counts already say it",
	[
		screenChartLayout(),
		boardScreen(
			Object.fromEntries(
				Object.entries(files).map(([file, source]) => [file, source.replaceAll("target: project.example#first", "target: project.example")]),
			),
			(api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />,
		),
	],
	function* ({ findElement, readAttribute }) {
		const progress = '[data-goal-section="progress"]';
		yield* Effect.promise(() => eventually(() => expect(findElement(`${progress} [role="progressbar"]`)).not.toBeNull()));
		expect(readAttribute(`${progress} [role="progressbar"]`, "aria-valuetext")).toBe("1 of 5 done");
		expect(findElement(`${progress} [data-goal-counts]`)).not.toBeNull();
		expect(findElement(`${progress} [data-goal-breakdown], ${progress} [data-slot="chart"]`)).toBeNull();
	},
);

screenStory.it(
	"lists linked work in the stock table with whole-row links and only used columns, ready work as planned and dropped work as done",
	[
		boardScreen(
			{
				...files,
				"dropped.md":
					"---\nid: task.dropped\nkind: task\nstatus: dropped\nrelationships:\n - kind: implements\n   target: project.example#first\n---\n# Dropped task",
				"ready.md":
					"---\nid: task.ready\nkind: task\nstatus: ready\nrelationships:\n - kind: implements\n   target: project.example\n---\n# Ready task",
			},
			(api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />,
		),
	],
	function* ({ findElement, findElements, readText, readAttribute }) {
		yield* Effect.promise(() => eventually(() => expect(findElement('[data-goal-item="task.ready"]')).not.toBeNull()));
		expect(readAttribute('[data-goal-section="progress"] [role="progressbar"]', "aria-valuetext")).toBe("2 of 7 done");
		for (const [id, group, chip] of [
			["task.dropped", "Done", "Dropped"],
			["task.ready", "Planned", "Ready"],
		] as const) {
			const row = findElement(`[data-goal-item="${id}"]`);
			expect(row?.getAttribute("data-slot")).toBe("table-row");
			expect(row?.closest("[data-goal-group]")?.getAttribute("data-goal-group")).toBe(group);
			expect(readText("[data-status-token]", row)).toBe(chip);
			expect(readAttribute('th[scope="row"] a', "href", row)).toBe(`/_board/item/${id}/`);
		}
		expect(findElement('[data-goal-group="In progress"]')).toBeNull();
		expect([...findElements('[data-goal-group="Planned"] [data-slot="table-head"][scope="col"]')].map((head) => head.textContent)).toEqual([
			"Work",
			"Criteria",
			"State",
		]);
		expect(readText('[data-goal-item="task.dropped"] td:nth-of-type(1)')).toBe("first");
		expect(readText('[data-goal-item="task.dropped"] th')).toBe("Dropped tasktask.dropped");
	},
);
