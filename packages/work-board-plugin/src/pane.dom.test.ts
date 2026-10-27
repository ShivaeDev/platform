import { expect } from "vitest";
import { pluginPane } from "#test/pluginPane.ts";

const GOAL = { counts: { blocked: 1, done: 1, parked: 1, running: 1, scheduled: 1 }, id: "goal.colors", title: "Ship the Board" };
const COLORS = ["#16853f", "#2879da", "#d74253", "#ad7400", "#808080"];

for (const surface of ["desktop", "terminal"] as const) {
	pluginPane.it(`renders every goal state and its legend on ${surface}`, [], function* ({ show, screen }) {
		yield* show([], [GOAL], surface);
		const pane = screen();
		for (const [index, state] of ["Done", "Running", "Blocked", "Scheduled", "Parked"].entries()) {
			const legend = [...pane.querySelectorAll("span")].find((node) => node.textContent === `${state} ` || node.textContent === `▰ ${state} `);
			expect(legend, state).toBeDefined();
			expect(legend?.querySelector("span")?.style.color).toBe(COLORS[index]);
		}
		if (surface === "desktop") {
			expect([...pane.querySelectorAll("svg rect")].map((segment) => segment.getAttribute("fill"))).toEqual(COLORS);
			expect(pane.querySelector("[role=img]")?.getAttribute("aria-label")).toContain("1 running, 1 blocked, 1 scheduled, 1 parked");
			expect([...pane.querySelectorAll("svg path")].map((boundary) => boundary.getAttribute("stroke"))).toEqual(new Array(4).fill("#000000"));
		} else {
			const segments = [...pane.querySelectorAll("span")].filter((node) => /^ ?▰+$/u.test(node.textContent ?? "") && node.children.length === 0);
			expect(segments.slice(0, 5).map((node) => node.style.color)).toEqual(COLORS);
		}
	});
}

pluginPane.it("names working, dependency, held area, CI, review and maintainer work and counts each state", [], function* ({ show, screen }) {
	yield* show(
		[
			{ document: { title: "Build the pane" }, stage: "working", workId: "build" },
			{
				attentionOwner: "automation",
				stage: "waiting",
				waitingReason: "waiting for dependency task.foundation: not done on the Board",
				workId: "dependent",
			},
			{ attentionOwner: "orchestrator", stage: "waiting", waitingReason: "waiting for area work-board held by task.other", workId: "area" },
			{ attentionOwner: "automation", stage: "waiting", waitingReason: "Waiting for required checks: typecheck", workId: "ci" },
			{ stage: "reviewing", workId: "review" },
			{ attentionOwner: "maintainer", stage: "waiting", waitingReason: "Approve the merge", workId: "merge" },
		],
		[],
	);
	const pane = screen();
	for (const [label, color] of [
		["Working", "#2879da"],
		["Waiting on task or area · waiting for dependency task.foundation: not done on the Board", "#9467cd"],
		["Waiting on task or area · waiting for area work-board held by task.other", "#9467cd"],
		["Waiting on CI or review · Waiting for required checks: typecheck", "#00868b"],
		["Waiting on CI or review · Reviewing", "#00868b"],
		["Waiting on you · Approve the merge", "#ad7400"],
		["1 Working", "#2879da"],
		["2 Waiting on task or area", "#9467cd"],
		["2 Waiting on CI or review", "#00868b"],
		["1 Waiting on you", "#ad7400"],
	]) {
		const text = [...pane.querySelectorAll("span")].find((node) => node.textContent === label);
		expect(text, label).toBeDefined();
		expect(text?.style.color, label).toBe(color);
	}
});
