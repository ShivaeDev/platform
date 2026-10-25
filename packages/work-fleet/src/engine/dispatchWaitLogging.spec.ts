import { expect } from "vitest";
import { sharedArea } from "#test/engineSchedulingTraits.ts";
import { engine, isolatedEngine } from "#test/engineStory.ts";
import { noChangeReported, oneExecutionSlot } from "#test/engineTraits.ts";
import { markdownAreas } from "#test/markdownAreas.ts";

engine.it("dependency waits log once per reason across scheduling cycles and restart", [], function* (fleet) {
	yield* fleet.prepareWork("dependent");
	yield* fleet.schedule();
	yield* fleet.schedule();
	yield* fleet.restart();
	yield* fleet.schedule();
	expect(fleet.recordedSchedulerLogs()).toEqual([
		{
			annotations: { workId: "dependent" },
			cause: "",
			level: "Info",
			message: ["Fleet dispatch waiting", "waiting for dependency one: not done on the Board; no accepted outcome"],
		},
	]);
	fleet.setDependencies("dependent", ["two"]);
	yield* fleet.schedule();
	yield* fleet.schedule();
	const changedWaits = ["Info", "Info"];
	expect(fleet.recordedSchedulerLogs().map((entry) => entry.level)).toEqual(changedWaits);
	expect(fleet.recordedSchedulerLogs()[1]).toEqual({
		annotations: { workId: "dependent" },
		cause: "",
		level: "Info",
		message: ["Fleet dispatch waiting", "waiting for dependency two: not done on the Board; no accepted outcome"],
	});
});

engine.it("area waits log once until the holder changes", [sharedArea, noChangeReported()], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.dispatch("one");
	yield* fleet.prepareWork("two");
	yield* fleet.schedule();
	yield* fleet.schedule();
	expect(fleet.recordedSchedulerLogs()).toEqual([
		{ annotations: { workId: "two" }, cause: "", level: "Info", message: ["Fleet dispatch waiting", "waiting for area shared held by one"] },
	]);
	yield* fleet.finishWorker("one");
	yield* fleet.reconcile("one");
	yield* fleet.reserveForeign("second-owner", ["shared"]);
	yield* fleet.schedule();
	yield* fleet.schedule();
	const changedWaits = ["Info", "Info"];
	expect(fleet.recordedSchedulerLogs().map((entry) => entry.level)).toEqual(changedWaits);
	expect(fleet.recordedSchedulerLogs()[1]).toEqual({
		annotations: { workId: "two" },
		cause: "",
		level: "Info",
		message: ["Fleet dispatch waiting", "waiting for area shared held by second-owner"],
	});
});

engine.it("back-pressure logs again when the wait changes from execution to delivery capacity", [oneExecutionSlot], function* (fleet) {
	yield* fleet.occupyExecution("other-host");
	yield* fleet.prepareWork("one");
	yield* fleet.schedule();
	yield* fleet.schedule();
	expect(fleet.recordedSchedulerLogs()).toEqual([
		{ annotations: { workId: "one" }, cause: "", level: "Info", message: ["Fleet dispatch waiting", "execution capacity is occupied (limit 1)"] },
	]);
	yield* fleet.vacateExecution("other-host");
	yield* fleet.reserveForeign("first-pr");
	yield* fleet.reserveForeign("second-pr");
	yield* fleet.schedule();
	yield* fleet.schedule();
	const changedWaits = ["Info", "Info"];
	expect(fleet.recordedSchedulerLogs().map((entry) => entry.level)).toEqual(changedWaits);
	expect(fleet.recordedSchedulerLogs()[1]).toEqual({
		annotations: { workId: "one" },
		cause: "",
		level: "Info",
		message: ["Fleet dispatch waiting", "backlog capacity is occupied (limit 2)"],
	});
});

isolatedEngine.it("a real dispatch error after an area wait still warns with its cause every cycle", [markdownAreas], function* (fleet) {
	yield* fleet.reserveForeign("other-host", ["shared"]);
	yield* fleet.prepareWork("one");
	yield* fleet.schedule();
	expect(fleet.recordedSchedulerLogs()).toEqual([
		{ annotations: { workId: "one" }, cause: "", level: "Info", message: ["Fleet dispatch waiting", "waiting for area shared held by other-host"] },
	]);
	fleet.duplicateBoardItem("one");
	yield* fleet.schedule();
	yield* fleet.schedule();
	const failures = fleet.recordedSchedulerLogs().slice(1);
	expect(failures.map((entry) => entry.level)).toEqual(["Warn", "Warn"]);
	for (const entry of failures) {
		expect(entry.annotations).toEqual({ workId: "one" });
		expect(entry.level).toBe("Warn");
		expect(entry.message).toEqual(["Fleet dispatch failed"]);
		expect(entry.cause).toContain("Board identity is missing or ambiguous: one");
		expect(entry.cause).toContain("BoardFailure");
	}
});
