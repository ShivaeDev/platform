import { expect } from "vitest";
import { admissionItems, reviewSlotWait } from "#test/admissionItems.ts";
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

pluginPane.it("keeps started work in flight through checks, review, merge and questions", [], function* ({ show, section }) {
	yield* show(admissionItems, []);
	const flight = section("In flight");
	for (const label of [
		"Build the pane",
		"Waiting for required checks: typecheck",
		"Reviewing",
		"Approve the merge",
		"Which approach should I use?",
	]) {
		expect(flight.textContent).toContain(label);
	}
	for (const title of ["Ship the integration", "Render the Board", "Run the next worker", "Wait for execution capacity"]) {
		expect(flight.textContent).not.toContain(title);
	}
});

pluginPane.it("shows an approved dependency wait as blocked and names its task", [], function* ({ show, section }) {
	yield* show(admissionItems, []);
	const blocked = section("Blocked");
	expect(blocked.textContent).toContain("Ship the integration");
	const reason = [...blocked.querySelectorAll("span")].find(
		(node) => node.textContent === "Blocked · waiting for dependency task.foundation: not done on the Board",
	);
	expect(reason?.style.color).toBe("#d74253");
	expect(section("Not started").contains(blocked)).toBe(true);
});

pluginPane.it("queues approved area and slot waits and names what each waits for", [], function* ({ show, section }) {
	yield* show(admissionItems, []);
	const queued = section("Queued");
	for (const label of ["Render the Board", "Run the next worker", "Wait for execution capacity"]) {
		expect(queued.textContent).toContain(label);
	}
	for (const label of [
		"Queued · waiting for area work-board held by task.other",
		"Queued · Waiting for a worker slot",
		"Queued · execution capacity is occupied (limit 2)",
	]) {
		const reason = [...queued.querySelectorAll("span")].find((node) => node.textContent === label);
		expect(reason?.style.color, label).toBe("#ad7400");
	}
	expect(section("Not started").contains(queued)).toBe(true);
});

pluginPane.it("counts only started work in the pane and band and counts blocked and queued separately", [], function* ({ show, section, band }) {
	yield* show(admissionItems, []);
	expect(section("In flight").firstElementChild?.textContent).toBe("In flight(5)1 Working2 Waiting on CI or review2 Waiting on you");
	expect(section("Not started").firstElementChild?.textContent).toBe("Not started(4)");
	expect(section("Blocked").firstElementChild?.textContent).toBe("Blocked(1)");
	expect(section("Queued").firstElementChild?.textContent).toBe("Queued(3)");
	expect(band()).toBe("Needs you 0 · In flight 5 · Goals 0/0");
});

pluginPane.it("keeps an existing PR in flight while its reviewer waits for an execution slot", [], function* ({ show, section, band }) {
	yield* show([...admissionItems, reviewSlotWait], []);
	const flight = section("In flight");
	expect(flight.textContent).toContain("Review the existing PR");
	expect(flight.querySelector("a")?.getAttribute("href")).toBe("https://github.com/example/project/pull/12");
	expect(section("Queued").textContent).not.toContain("Review the existing PR");
	expect(band()).toBe("Needs you 0 · In flight 6 · Goals 0/0");
});
