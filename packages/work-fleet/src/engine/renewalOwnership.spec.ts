import { describe, expect } from "@effect/vitest";
import { workerResultUnavailable } from "#test/engineLaunchTraits.ts";
import { engine } from "#test/engineStory.ts";
import { noChangeReported } from "#test/engineTraits.ts";
import { refusal } from "#test/refusal.ts";

describe("renewal reconciles prior result ownership", () => {
	engine.it("a context edit cannot discard an unadopted worker PR's reservation", [], function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		fleet.editWork("one", "board-one-next");
		fleet.finishWorkers();
		const stale = yield* fleet.reconcile("one");
		expect(stale.value.result).toBeUndefined();
		fleet.approveWork("one", "board-one-next");
		const renewed = yield* fleet.prepareWork("one");
		expect(renewed.value.history?.[0]?.result).toMatchObject({ kind: "change", pr: "https://example.invalid/pr/one" });
		expect(renewed.value.history?.[0]?.outcome).toBeUndefined();
		expect(yield* fleet.foreignReservations()).toEqual([{ areas: [], backlog: true, executing: false, owner: "https://example.invalid/pr/one" }]);
		const dispatched = yield* fleet.dispatch("one");
		expect(dispatched.value.step).toBe("working");
		expect(fleet.launches()).toEqual(["operation-1", "operation-2"]);
	});
	engine.it("unknown terminal result ownership cannot be turned into a new worker", [workerResultUnavailable()], function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		fleet.editWork("one", "board-one-next");
		fleet.finishWorkers();
		yield* fleet.reconcile("one");
		fleet.approveWork("one", "board-one-next");
		const error = yield* refusal(fleet.prepareWork("one"));
		expect(error).toMatch(/^forbidden: .*ownership is unavailable/u);
		const retained = yield* fleet.get("one");
		expect(retained.value.history).toBeUndefined();
		expect(retained.value.attempts.map((entry) => entry.operationId)).toEqual(["operation-1"]);
		expect(retained.value.boardRevision).toBe("board-one");
		expect(fleet.launches()).toEqual(["operation-1"]);
	});
	engine.it("an observing failure conserves the old attempt and reservation", [noChangeReported()], function* (fleet) {
		yield* fleet.prepareWork("one");
		const submitted = yield* fleet.dispatch("one");
		fleet.finishWorkers();
		fleet.editWork("one", "board-one-next");
		yield* fleet.reconcile("one");
		fleet.approveWork("one", "board-one-next");
		fleet.failNextObservation(submitted.value.attempts[0]?.receipt?.turnId ?? "missing");
		const preparedOutcome = yield* refusal(fleet.prepareWork("one"));
		expect(preparedOutcome).toMatch(/^forbidden: /u);
		expect((yield* fleet.get("one")).value.history).toBeUndefined();
		expect(fleet.launches()).toEqual(["operation-1"]);
	});
});
