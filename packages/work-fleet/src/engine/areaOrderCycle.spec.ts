import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { areaOrder, cyclicChecks } from "#test/areaOrderStory.ts";
import { mergeOrderCycle } from "#test/mergeOrderCycle.ts";

areaOrder.it(
	"the green PR drops its cycle wait when the other PR is red, including after restart",
	[mergeOrderCycle, cyclicChecks],
	function* ({ prepareWork, dispatch, checksFail, finishWorkers, reconcile, restart, statusText, get }) {
		for (const id of ["one", "two"]) {
			yield* prepareWork(id);
			yield* dispatch(id);
		}
		checksFail("one");
		finishWorkers();
		yield* reconcile("one");

		const ready = yield* reconcile("two");

		expect(ready.value.decision?.code).toBe("reviewed-pr-ready");
		yield* outcomes([
			[
				"red PR's stored merge order",
				() => get("one"),
				expect.objectContaining({
					value: expect.objectContaining({ predictedConflictHold: expect.objectContaining({ prs: ["https://example.invalid/pr/two"] }) }),
				}),
			],
			["status", () => statusText(), expect.not.stringContaining("Stuck: wait cycle")],
		]);
		yield* restart();
		expect((yield* reconcile("two")).value.predictedConflictHold).toBeUndefined();
	},
);
