import { expect } from "vitest";
import { engine } from "#test/engineStory.ts";
import { mergeOrderCycle } from "#test/mergeOrderCycle.ts";

engine.it(
	"a cycle with no green PR and no repair reports stuck once while dependents keep waiting",
	[mergeOrderCycle],
	function* ({ prepareWork, dispatch, finishWorkers, reconcile, statusText, restart, setDependencies }) {
		setDependencies("dependent", []);
		for (const id of ["one", "two", "dependent"]) {
			yield* prepareWork(id);
			yield* dispatch(id);
		}
		finishWorkers();
		for (const id of ["one", "two", "dependent"]) {
			yield* reconcile(id);
		}

		const status = yield* statusText();

		const reason =
			"Stuck: wait cycle: one (https://example.invalid/pr/one) -> two (https://example.invalid/pr/two) -> one (https://example.invalid/pr/one)";
		expect(status.match(/Stuck: wait cycle:/gu)).toEqual(["Stuck: wait cycle:"]);
		expect(status).toContain(`one  waiting  ${reason}`);
		expect(status).toContain("dependent  waiting  waiting for https://example.invalid/pr/one to merge");
		yield* restart();
		yield* reconcile("two");
		expect(yield* statusText()).toBe(status);
	},
);
