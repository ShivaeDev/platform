import { expect } from "@effect/vitest";
import { providerCapacityRejected } from "#test/engineCapacityTraits.ts";
import { reviewAndChecksRequestRepairs } from "#test/engineLifecycleTraits.ts";
import { engine } from "#test/engineStory.ts";
import { humanMergeRequired } from "#test/engineTraits.ts";

for (const repair of ["review", "checks", "manual"] as const) {
	engine.it(
		`${repair} repair turns receive the PR result protocol once`,
		[reviewAndChecksRequestRepairs(), humanMergeRequired()],
		function* ({ prepareWork, fleet, finishWorkers, providerTurns }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			if (repair !== "review") {
				yield* fleet.reconcile("one");
				finishWorkers();
			}
			if (repair === "manual") {
				yield* fleet.reconcile("one");
				finishWorkers();
				yield* fleet.reconcile("one");
			}

			if (repair === "manual") {
				yield* fleet.continue("one", "Check another case");
			} else {
				yield* fleet.reconcile("one");
			}

			const prompt = providerTurns().at(-1)?.prompt;
			expect(prompt?.match(/FLEET_HEAD: <sha>\nFLEET_PR: <url or none>/gu)).toEqual(["FLEET_HEAD: <sha>\nFLEET_PR: <url or none>"]);
		},
	);
}

engine.it(
	"a capacity retry retains one PR result protocol after restart",
	[providerCapacityRejected()],
	function* ({ prepareWork, fleet, recoverProvider, setFleetTime, restart, schedule, providerTurns }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		recoverProvider();
		setFleetTime(30_100);
		yield* restart();

		yield* schedule();

		const prompt = providerTurns().at(-1)?.prompt;
		expect(prompt?.match(/FLEET_HEAD: <sha>\nFLEET_PR: <url or none>/gu)).toEqual(["FLEET_HEAD: <sha>\nFLEET_PR: <url or none>"]);
	},
);
