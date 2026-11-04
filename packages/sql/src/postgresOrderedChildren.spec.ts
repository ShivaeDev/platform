import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { daysStored, orderedDays } from "#test/orderedDays.ts";

const original = [1, 2, 3].map((id, position) => ({ id, name: `Day ${id}`, position, version: 0 }));
const reordered = [3, 1, 2].map((id, position) => ({ id, name: `Day ${id}`, position, version: 0 }));

orderedDays.it("reordering children leaves every version and another parent's order alone", [daysStored()], function* ({ readDays, reorder }) {
	expect(yield* readDays()).toEqual(original);

	yield* reorder([3, 1, 2]);

	yield* outcomes([
		["plan one's stored days", () => readDays(), reordered],
		["plan two's stored days", () => readDays(2), [{ id: 4, name: "Day 4", position: 0, version: 0 }]],
	]);
});

orderedDays.it(
	"an edit sheet using its original version can save after its siblings reorder",
	[daysStored()],
	function* ({ readDays, renameDay, reorder }) {
		yield* reorder([3, 1, 2]);

		yield* renameDay();

		expect(yield* readDays()).toEqual([reordered[0], { id: 1, name: "Edited day", position: 1, version: 1 }, reordered[2]]);
	},
);

orderedDays.it("moving a child shifts sibling positions without changing their versions", [daysStored()], function* ({ move, readDays }) {
	yield* move(1, 3, 0);

	expect(yield* readDays()).toEqual(reordered);
});

orderedDays.it("appending a child places it after its parent's children at version zero", [daysStored()], function* ({ append, readDays }) {
	yield* append(1, 5);

	expect(yield* readDays()).toEqual([...original, { id: 5, name: "Day 5", position: 3, version: 0 }]);
});

orderedDays.it("appending to an empty parent starts at position zero", [], function* ({ append, readDays }) {
	yield* append(1, 1);

	expect(yield* readDays()).toEqual([{ id: 1, name: "Day 1", position: 0, version: 0 }]);
});

orderedDays.it("appending to a missing parent refuses the write", [], function* ({ append, readDays }) {
	const refusal = yield* append(99, 1);

	expect(refusal).toBe("failed with no such row");
	expect(yield* readDays(99)).toEqual([]);
});

orderedDays.it("moving another parent's child refuses the write and keeps this parent's order", [daysStored()], function* ({ move, readDays }) {
	const refusal = yield* move(1, 4, 0);

	expect(refusal).toBe("refused membership");
	expect(yield* readDays()).toEqual(original);
});

orderedDays.it(
	"a concurrent reorder waits on the parent lock then commits without changing versions",
	[daysStored()],
	function* ({ startHeldReorder, startCompetingReorder, waitingReorder, finishReorders, readDays }) {
		yield* startHeldReorder();
		yield* startCompetingReorder();

		expect(yield* waitingReorder()).toBe("waiting on the parent lock");

		yield* finishReorders();

		expect(yield* readDays()).toEqual([2, 1, 3].map((id, position) => ({ id, name: `Day ${id}`, position, version: 0 })));
	},
);

for (const ids of [
	[1, 1, 3],
	[1, 2],
	[1, 2, 4],
]) {
	orderedDays.it(
		`reordering with ${ids.join(", ")} refuses a list that is not this parent's children`,
		[daysStored()],
		function* ({ readDays, reorder }) {
			const refusal = yield* reorder(ids);

			expect(refusal).toBe("refused membership");
			expect(yield* readDays()).toEqual(original);
		},
	);
}

for (const position of [-1, 3, 0.5]) {
	orderedDays.it(`moving to position ${position} refuses an invalid position`, [daysStored()], function* ({ move, readDays }) {
		const refusal = yield* move(1, 1, position);

		expect(refusal).toBe("refused position");
		expect(yield* readDays()).toEqual(original);
	});
}
