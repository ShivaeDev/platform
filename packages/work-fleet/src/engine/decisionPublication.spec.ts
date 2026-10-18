import { expect } from "vitest";
import { fleetBoardStory, noChangeReport } from "#test/fleetBoardStory.ts";

fleetBoardStory.it("a reviewed green PR publishes merge readiness to the orchestrator", [], function* (fleet) {
	yield* fleet.prepare();
	yield* fleet.dispatch();
	fleet.finishWorkers();
	const ready = (yield* fleet.reconcile()).value;
	expect(ready.review?.verdict).toBe("approved");
	expect(ready.checks?.passed).toBe(true);
	expect(ready.decision?.code).toBe("reviewed-pr-ready");
	const documents = yield* fleet.publishedDocuments();
	expect(documents.find((entry) => entry.file === ready.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
		{ responseFrom: ["orchestrator"], state: "open" },
	]);
});

fleetBoardStory.it("reassignment closes the previous published decision and keeps the new decision open", [], function* (fleet) {
	yield* fleet.prepare();
	yield* fleet.dispatch();
	fleet.finishWorkers();
	const ready = (yield* fleet.reconcile()).value;
	const decision = ready.decision;
	if (decision === undefined) {
		throw new Error("Missing merge decision");
	}
	const reassigned = (yield* fleet.reassign(decision.id, "maintainer")).value;
	const documents = yield* fleet.publishedDocuments();
	expect(documents.find((entry) => entry.file === decision.published?.sourcePath)?.parsed.fields.attention).toMatchObject([{ state: "closed" }]);
	expect(documents.find((entry) => entry.file === reassigned.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
		{ responseFrom: ["maintainer"], state: "open" },
	]);
});

fleetBoardStory.it("changed Board context publishes to the orchestrator and closes merge readiness", [], function* (fleet) {
	yield* fleet.prepare();
	yield* fleet.dispatch();
	fleet.finishWorkers();
	const ready = (yield* fleet.reconcile()).value;
	yield* fleet.editBrief();
	const changed = (yield* fleet.reconcile()).value;
	expect(changed.decision?.reason).toBe("Board context changed");
	const documents = yield* fleet.publishedDocuments();
	expect(documents.find((entry) => entry.file === ready.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
		{ state: "closed" },
	]);
	expect(documents.find((entry) => entry.file === changed.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
		{ responseFrom: ["orchestrator"], state: "open" },
	]);
});

fleetBoardStory.it("a changed brief at delivery asks the orchestrator", [noChangeReport], function* (fleet) {
	yield* fleet.prepare();
	yield* fleet.dispatch();
	fleet.finishWorkers();
	fleet.changeBriefWhenChecksFinish();
	const stopped = (yield* fleet.reconcile()).value;
	expect(stopped.decision?.reason).toBe("Board context changed");
	const documents = yield* fleet.publishedDocuments();
	expect(documents.find((entry) => entry.file === stopped.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
		{ responseFrom: ["orchestrator"], state: "open" },
	]);
});
