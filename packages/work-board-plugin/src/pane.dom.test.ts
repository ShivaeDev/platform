import { expect } from "vitest";
import { admissionItems, coding } from "#test/admissionItems.ts";
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

pluginPane.it("lists only started tasks with agent activity and turn durations", [], function* ({ show, section, screen, band }) {
	yield* show(admissionItems, [GOAL]);
	const flight = section("In flight");
	expect(flight.textContent).toContain("Build the pane");
	expect(flight.textContent).toContain("worker · coding2m");
	expect(flight.textContent).toContain("reviewer · not started yet");
	const reviewer = [...flight.querySelectorAll("span")].find((node) => node.textContent === "reviewer · not started yet");
	expect(reviewer?.parentElement?.children.length).toBe(1);
	expect(flight.textContent).toContain("Times: current or finished agent turn");
	for (const title of ["Ship the integration", "Render the Board", "Run the next worker", "Not started", "Queued", "Waiting on task or area"]) {
		expect(screen().textContent).not.toContain(title);
	}
	expect(screen().querySelector("[role=img]")?.getAttribute("aria-label")).toContain("1 blocked, 1 scheduled");
	expect(band()).toBe("Needs you 0 · In flight 1 · Goals 1/5");
});

for (const state of ["reviewing", "addressing review", "fixing CI", "waiting for CI", "waiting for merge", "waiting on an answer"] as const) {
	pluginPane.it(`shows an agent ${state} with a finished turn's fixed duration`, [], function* ({ show, section }) {
		yield* show(
			[
				{
					...coding,
					agents: [
						{ finishedAt: 61_000, id: "worker", role: "worker", startedAt: 1000, state: state === "reviewing" ? "done" : state },
						{ finishedAt: null, id: "reviewer", role: "reviewer", startedAt: null, state: state === "reviewing" ? state : "not started yet" },
					],
				},
			],
			[],
		);
		const flight = section("In flight");
		expect(flight.textContent).toContain(state);
		expect(flight.textContent).toContain("1m");
		expect(flight.textContent).not.toContain("1d");
	});
}

for (const standing of [false, true]) {
	pluginPane.it(
		`distinguishes all tasks done from achieved and restores the bar for an open task (standing: ${standing})`,
		[],
		function* ({ show, section, click }) {
			const complete = { counts: { done: 2 }, id: "goal.complete", standing, title: "Complete tasks" };
			const achieved = { ...complete, id: "goal.achieved", standing: false, status: "done", title: "Achieved goal" };
			const another = { ...achieved, id: "goal.another", title: "Another achieved goal" };
			yield* show([], [achieved, complete, another]);
			let goals = section("Goals");
			expect(goals.textContent).toContain("Complete tasks");
			expect(goals.textContent).toContain("✓ all tasks done");
			expect(goals.textContent).not.toContain("Achieved goal");
			expect(goals.textContent).not.toContain("Another achieved goal");
			expect(goals.querySelectorAll("button")).toHaveLength(1);
			expect(goals.textContent).toContain("Achieved (2)");
			yield* click("Achieved (2)");
			expect(goals.textContent).toContain("Achieved goal");
			expect(goals.textContent).toContain("Another achieved goal");
			expect(goals.textContent?.indexOf("Complete tasks")).toBeLessThan(goals.textContent?.indexOf("Achieved (2)") ?? 0);
			expect(goals.textContent).toContain("✓ achieved");
			const check = [...goals.querySelectorAll("span")].find((node) => node.textContent === "✓ all tasks done");
			const achievedCheck = [...goals.querySelectorAll("span")].find((node) => node.textContent === "✓ achieved");
			expect(check?.style.color).not.toBe(achievedCheck?.style.color);
			expect(goals.querySelector("[role=img]")).toBeNull();
			yield* show([], [{ ...complete, counts: { done: 2, scheduled: 1 } }, achieved, another]);
			goals = section("Goals");
			expect(goals.textContent).not.toContain("all tasks done");
			expect(goals.querySelector("[role=img]")?.getAttribute("aria-label")).toContain("2 of 3 done");
			expect(goals.textContent).toContain("Achieved goal");
			yield* click("Achieved (2)");
			expect(goals.textContent).not.toContain("Achieved goal");
			expect(goals.textContent).not.toContain("Another achieved goal");
		},
	);
}
