import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { heldAreaAdmission } from "#test/heldAreaAdmission.ts";

isolatedEngine.it("two overlapping tasks cannot retain opposite queue positions after a brief revision", [heldAreaAdmission], function* (fleet) {
	fleet.setAreas("one", ["server", "starter"]);
	fleet.setAreas("two", ["starter", "server", "react", "contract"]);
	yield* fleet.prepareWork("one");
	yield* fleet.prepareWork("two");
	const dispatch = yield* fleet.dispatch("two").pipe(Effect.result, Effect.forkChild);
	yield* fleet.waitForGate("entered");
	fleet.reviseBrief("one", "revised-one");
	yield* fleet.prepareWork("one");
	expect(yield* fleet.attemptDispatch("one")).toMatchObject({ message: "waiting for area server queued ahead by two" });
	yield* fleet.releaseGate("release");
	yield* Fiber.join(dispatch);
	expect(fleet.providerStarts()).toMatchObject([{ prompt: "Implement two" }]);
	expect((yield* fleet.get("two")).value.step).toBe("working");
	yield* fleet.finishWorker("two");
	yield* fleet.reconcile("two");
	yield* fleet.schedule();
	expect((yield* fleet.get("one")).value.step).toBe("working");
	expect(fleet.providerStarts().filter(({ access }) => access !== "read-only")).toMatchObject([
		{ prompt: "Implement two" },
		{ prompt: "Implement one" },
	]);
});

isolatedEngine.it("three overlapping waiters make progress when held areas and queue positions change", [heldAreaAdmission], function* (fleet) {
	for (const [id, areas] of [
		["one", ["server", "starter", "contract"]],
		["two", ["server", "react", "board"]],
		["three", ["react", "starter"]],
	] as const) {
		fleet.approveWork(id, `board-${id}`);
		fleet.setAreas(id, areas);
		yield* fleet.prepareWork(id);
	}
	const dispatch = yield* fleet.dispatch("two").pipe(Effect.result, Effect.forkChild);
	yield* fleet.waitForGate("entered");
	yield* fleet.reserveForeign("contract-holder", ["contract"]);
	expect(yield* fleet.attemptDispatch("three")).toMatchObject({ message: "waiting for area react queued ahead by two" });
	yield* fleet.vacateExecution("contract-holder");
	fleet.reviseBrief("one", "revised-one");
	yield* fleet.prepareWork("one");
	yield* fleet.reserveForeign("board-holder", ["board"]);
	expect(yield* fleet.attemptDispatch("one")).toMatchObject({ message: "waiting for area starter queued ahead by three" });
	yield* fleet.vacateExecution("board-holder");
	yield* fleet.releaseGate("release");
	yield* Fiber.join(dispatch);
	expect((yield* fleet.get("two")).value.step).toBe("working");
	for (const [finished, next] of [
		["two", "three"],
		["three", "one"],
	] as const) {
		yield* fleet.finishWorker(finished);
		yield* fleet.reconcile(finished);
		yield* fleet.schedule();
		expect((yield* fleet.get(next)).value.step).toBe("working");
	}
	expect(fleet.providerStarts().filter(({ access }) => access !== "read-only")).toMatchObject([
		{ prompt: "Implement two" },
		{ prompt: "Implement three" },
		{ prompt: "Implement one" },
	]);
});
