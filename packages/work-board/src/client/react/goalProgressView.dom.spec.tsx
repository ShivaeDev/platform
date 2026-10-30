import { expect } from "vitest";
import { eventually } from "@shivaedev/test-story/client/react.ts";
import { goalPageFixture } from "#test/goalPageFixture.ts";
import { screenChartLayout } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { DocumentMain } from "./DocumentMain.tsx";

const files = { ...goalPageFixture(), "asks.md": "# No open asks" };

screenStory.it(
	"shows goal progress in five segments and charts each criterion by its text, with counts on the bars and empty criteria kept",
	[screenChartLayout(), boardScreen(files, (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />)],
	function* ({ findElement, findElements, keyboard, readAttribute, readText }) {
		yield* eventually(() => expect(findElement('[data-goal-section="progress"] [data-slot="chart"]')).not.toBeNull());
		const progress = '[data-goal-section="progress"]';
		expect(readAttribute(`${progress} [role="progressbar"]`, "aria-valuetext")).toBe(
			"1 of 5 done, 1 done, 0 running, 0 blocked, 0 scheduled, 4 parked",
		);
		expect(readText(`${progress} [data-slot="progress-value"]`)).toBe("1/5 done");
		expect([...findElements(`${progress} [data-goal-counts] li`)].map((entry) => [entry.dataset.status, entry.dataset.count])).toEqual([
			["done", "1"],
			["running", "0"],
			["blocked", "0"],
			["scheduled", "0"],
			["parked", "4"],
		]);
		yield* eventually(() => {
			expect(readText(`${progress} [data-goal-breakdown] h3`)).toBe("By criterion");
			const labels = [...findElements(`${progress} [data-goal-criterion-label] a`)];
			expect(labels.map((label) => [label.textContent, label.getAttribute("href")])).toEqual([
				["First criterion", "#criterion-first"],
				["Second criterion", "#criterion-second"],
			]);
			for (const label of labels) {
				expect(findElement(`${decodeURIComponent(label.getAttribute("href") ?? "")} h3`)?.textContent).toBe(label.textContent);
			}
			expect(
				[...findElements(`${progress} .recharts-bar-rectangle path`)].map((bar) => [bar.getAttribute("fill"), bar.getAttribute("width")]),
			).toEqual([
				["var(--color-parked)", "508"],
				["var(--muted)", "508"],
			]);
			expect([...findElements(`${progress} .recharts-label-list text`)].map((label) => [label.textContent, label.getAttribute("fill")])).toEqual([
				["2", "#fff"],
				["No linked work", null],
			]);
			expect([...findElements(`${progress} .recharts-legend-wrapper > div > div`)].map((entry) => entry.textContent)).toEqual([
				"Done",
				"Running",
				"Blocked",
				"Scheduled",
				"Parked",
			]);
		});
		expect(readText(`${progress} [data-goal-breakdown]`)).not.toContain("All work");
		keyboard("ArrowRight", {}, findElement(`${progress} .recharts-surface`) ?? document);
		yield* eventually(() =>
			expect(findElement(`${progress} .recharts-tooltip-wrapper [class*="font-medium"]`)?.textContent).toBe("Second criterion"),
		);
	},
);

screenStory.it(
	"leaves a count off a bar segment too narrow to hold it",
	[
		screenChartLayout(),
		boardScreen(
			{
				...files,
				...Object.fromEntries(
					Array.from({ length: 100 }, (_, index) => [
						`extra-${index}.md`,
						`---\nid: task.extra-${index}\nkind: task\nstatus: done\nrelationships:\n - kind: implements\n   target: project.example#first\n---\n# Extra ${index}`,
					]),
				),
			},
			(api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />,
		),
	],
	function* ({ findElements }) {
		const progress = '[data-goal-section="progress"]';
		yield* eventually(() =>
			expect(
				[...findElements(`${progress} .recharts-bar-rectangle path`)].map((bar) => [bar.getAttribute("fill"), bar.getAttribute("width")]),
			).toEqual([
				["var(--color-done)", expect.any(String)],
				["var(--color-parked)", expect.any(String)],
				["var(--muted)", "508"],
			]),
		);
		expect([...findElements(`${progress} .recharts-label-list text`)].map((label) => [label.textContent, label.getAttribute("fill")])).toEqual([
			["100", "#000"],
			["No linked work", null],
		]);
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
		yield* eventually(() => expect(findElement(`${progress} [role="progressbar"]`)).not.toBeNull());
		expect(readAttribute(`${progress} [role="progressbar"]`, "aria-valuetext")).toBe(
			"1 of 5 done, 1 done, 0 running, 0 blocked, 0 scheduled, 4 parked",
		);
		expect(findElement(`${progress} [data-goal-counts]`)).not.toBeNull();
		expect(findElement(`${progress} [data-goal-breakdown], ${progress} [data-slot="chart"]`)).toBeNull();
	},
);

screenStory.it(
	"lists linked work in the stock table with whole-row links and only used columns, ready and dropped work in their own groups",
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
		yield* eventually(() => expect(findElement('[data-goal-item="task.ready"]')).not.toBeNull());
		expect(readAttribute('[data-goal-section="progress"] [role="progressbar"]', "aria-valuetext")).toBe(
			"1 of 6 done, 1 done, 0 running, 0 blocked, 0 scheduled, 5 parked",
		);
		for (const [id, group, chip] of [
			["task.dropped", "Dropped", "Dropped"],
			["task.ready", "Ready", "Ready"],
		] as const) {
			const row = findElement(`[data-goal-item="${id}"]`);
			expect(row?.getAttribute("data-slot")).toBe("table-row");
			expect(row?.closest("[data-goal-group]")?.getAttribute("data-goal-group")).toBe(group);
			expect(readText("[data-status-token]", row)).toBe(chip);
			expect(readAttribute('th[scope="row"] a', "href", row)).toBe(`/_board/item/${id}/`);
		}
		expect(findElement('[data-goal-group="In progress"]')).toBeNull();
		expect([...findElements('[data-goal-group="Draft"] [data-slot="table-head"][scope="col"]')].map((head) => head.textContent)).toEqual([
			"Work",
			"Criteria",
			"State",
		]);
		expect(readText('[data-goal-item="task.dropped"] td:nth-of-type(1)')).toBe("first");
		expect(readText('[data-goal-item="task.dropped"] th')).toBe("Dropped tasktask.dropped");
	},
);
