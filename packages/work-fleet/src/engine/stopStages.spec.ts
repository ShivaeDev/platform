import { expect } from "vitest";
import { engine } from "#test/engineStory.ts";
import { humanMergeRequired, reviewRequestsRepairs } from "#test/engineTraits.ts";

engine.it("stopping prepared work releases it before a provider turn starts", [], function* ({ fleet, prepareWork, providerStarts }) {
	yield* prepareWork("one");
	expect((yield* fleet.stop("one")).value.step).toBe("released");
	expect(providerStarts()).toEqual([]);
});

engine.it(
	"stopping waiting work releases it without another turn",
	[humanMergeRequired()],
	function* ({ fleet, prepareWork, finishWorkers, providerStarts }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.step).toBe("waiting");
		const starts = providerStarts();
		expect((yield* fleet.stop("one")).value.step).toBe("released");
		expect(providerStarts()).toEqual(starts);
	},
);

engine.it(
	"stopping a repair interrupts the repair turn and releases ownership",
	[reviewRequestsRepairs()],
	function* ({ fleet, prepareWork, finishWorkers, providerInterrupts }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const repairing = yield* fleet.reconcile("one");
		expect(repairing.value.attempts.at(-1)).toMatchObject({ role: "repair" });
		expect((yield* fleet.stop("one")).value.step).toBe("released");
		expect(providerInterrupts()).toEqual([repairing.value.attempts.at(-1)?.receipt]);
	},
);

engine.it("dropping prepared work records cancellation without launching it", [], function* ({ fleet, prepareWork, setBoardStatus, providerStarts }) {
	yield* prepareWork("one");
	setBoardStatus("one", "dropped");
	const stopped = yield* fleet.dispatch("one");
	expect(stopped.value).toMatchObject({ releaseReason: "Work cancelled because Board status is dropped.", step: "released" });
	expect(stopped.value.responses).toMatchObject([{ action: "release", boardAcknowledged: true }]);
	expect(providerStarts()).toEqual([]);
});
