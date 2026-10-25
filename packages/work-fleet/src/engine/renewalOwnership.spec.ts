import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { workerResultUnavailable } from "#test/engineLaunchTraits.ts";
import { engine } from "#test/engineStory.ts";
import { noChangeReported } from "#test/engineTraits.ts";

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
		expect((yield* fleet.dispatch("one")).value.step).toBe("working");
		expect(fleet.launches()).toEqual(["operation-1", "operation-2"]);
	});
	engine.it("unknown terminal result ownership cannot be turned into a new worker", [workerResultUnavailable()], function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		fleet.editWork("one", "board-one-next");
		fleet.finishWorkers();
		yield* fleet.reconcile("one");
		fleet.approveWork("one", "board-one-next");
		const error = yield* Effect.flip(fleet.prepareWork("one"));
		expect(error).toMatchObject({ _tag: "Forbidden", message: expect.stringContaining("ownership is unavailable") });
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
		expect(yield* Effect.flip(fleet.prepareWork("one"))).toMatchObject({ _tag: "Forbidden" });
		expect((yield* fleet.get("one")).value.history).toBeUndefined();
		expect(fleet.launches()).toEqual(["operation-1"]);
	});
});
