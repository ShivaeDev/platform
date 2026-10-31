import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { foreignAreaStory } from "#test/foreignAreaStory.ts";

const PR = "https://github.com/synthetic/project/pull/10";
const HELD = expect.stringContaining(`held by ${PR}`);
const REFUSED = `admission refused: waiting for area work-fleet/host held by ${PR}`;

for (const [match, requested, held] of [
	["pr", ["ignored"], ["work-fleet"]],
	["branch", ["ignored"], ["work-fleet"]],
	["worker-branch", ["ignored"], ["work-fleet"]],
	["unmatched", ["work-fleet", "documentation"], ["work-fleet", "documentation"]],
] as const) {
	foreignAreaStory.it(`reserving a foreign PR found by ${match} holds ${held.join(" and ")}`, [], function* (fleet) {
		fleet.foreignPr(match);

		const reserved = yield* fleet.reserve(requested);

		expect(reserved).toBe("reserved");
		expect(yield* fleet.reservations()).toMatchObject([{ areas: held, backlog: true, executing: false }]);
	});
}

foreignAreaStory.it("a foreign PR's held area queues overlapping work while disjoint work launches", [], function* (fleet) {
	yield* fleet.reservedForeignPr();
	fleet.task("one", ["work-fleet/host"]);
	fleet.task("two", ["work-board/ui"]);

	const one = yield* fleet.dispatch("one");
	const two = yield* fleet.dispatch("two");

	expect({ one, two }).toEqual({ one: REFUSED, two: "dispatched" });
	yield* outcomes([
		["one", () => fleet.workOf("one"), { blocker: HELD, roles: [], step: "queued" }],
		["two", () => fleet.workOf("two"), { blocker: "no blocker", roles: ["worker"], step: "working" }],
		["launched work", () => fleet.launchedWork(), ["two"]],
	]);
});

foreignAreaStory.it("an unreadable foreign PR is reported on admission and keeps its areas held", [], function* (fleet) {
	yield* fleet.reservedForeignPr();
	fleet.task("one", ["work-fleet/host"]);
	expect(yield* fleet.dispatch("one")).toBe(REFUSED);
	fleet.prReadFails();

	const admitted = yield* fleet.admit();
	const dispatched = yield* fleet.dispatch("one");

	expect({ admitted, dispatched }).toEqual({ admitted: [expect.stringContaining(PR)], dispatched: REFUSED });
	yield* outcomes([
		["one", () => fleet.workOf("one"), { blocker: HELD, step: "queued" }],
		["launched work", () => fleet.launchedWork(), []],
	]);
});

foreignAreaStory.it("a closed foreign PR drops its reservation and launches the work it held", [], function* (fleet) {
	yield* fleet.reservedForeignPr();
	fleet.task("one", ["work-fleet/host"]);
	expect(yield* fleet.dispatch("one")).toBe(REFUSED);
	fleet.pr("closed");

	const admitted = yield* fleet.admit();
	const dispatched = yield* fleet.dispatch("one");

	expect({ admitted, dispatched }).toEqual({ admitted: [], dispatched: "dispatched" });
	yield* outcomes([
		["reservations", () => fleet.reservations(), []],
		["one", () => fleet.workOf("one"), { roles: ["worker"], step: "working" }],
		["launched work", () => fleet.launchedWork(), ["one"]],
	]);
});
