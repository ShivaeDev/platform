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

for (const forgetReceipts of [false, true]) {
	fleetBoardStory.it(
		`upgrade closes legacy publications ${forgetReceipts ? "without" : "with"} supersession receipts and preserves the current decision`,
		[],
		function* (fleet) {
			yield* fleet.prepare();
			yield* fleet.dispatch();
			fleet.finishWorkers();
			const ready = (yield* fleet.reconcile()).value;
			const decision = ready.decision;
			if (decision?.published === undefined) {
				throw new Error("Missing merge publication");
			}
			const oldSource = yield* fleet.readSource(decision.published.sourcePath);
			const reassigned = (yield* fleet.reassign(decision.id, "maintainer")).value;
			yield* fleet.restoreLegacyPublication(decision.published.sourcePath, oldSource, forgetReceipts);
			yield* fleet.runUpgrade();
			const documents = yield* fleet.publishedDocuments();
			expect(documents.find((entry) => entry.file === decision.published?.sourcePath)?.parsed.fields.attention).toMatchObject([{ state: "closed" }]);
			expect(documents.find((entry) => entry.file === reassigned.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
				{ state: "open" },
			]);
			const closedSource = yield* fleet.readSource(decision.published.sourcePath);
			yield* fleet.reopenBoard();
			expect(yield* fleet.readSource(decision.published.sourcePath)).toBe(closedSource);
		},
	);
}

fleetBoardStory.it("storage upgrade reroutes an existing maintainer merge decision on reconciliation", [], function* (fleet) {
	yield* fleet.prepare();
	yield* fleet.dispatch();
	fleet.finishWorkers();
	const ready = (yield* fleet.reconcile()).value;
	if (ready.decision === undefined) {
		throw new Error("Missing merge decision");
	}
	const legacy = (yield* fleet.reassign(ready.decision.id, "maintainer")).value;
	yield* fleet.legacyAutomaticRouting();
	yield* fleet.upgradeStorage();
	const upgraded = (yield* fleet.restartAndReconcile()).value;
	expect(upgraded.decision?.code).toBe("reviewed-pr-ready");
	const documents = yield* fleet.publishedDocuments();
	expect(documents.find((entry) => entry.file === legacy.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
		{ state: "closed" },
	]);
	expect(documents.find((entry) => entry.file === upgraded.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
		{ responseFrom: ["orchestrator"], state: "open" },
	]);
});

fleetBoardStory.it("storage upgrade preserves an explicit maintainer reassignment", [], function* (fleet) {
	yield* fleet.prepare();
	yield* fleet.dispatch();
	fleet.finishWorkers();
	const ready = (yield* fleet.reconcile()).value;
	if (ready.decision === undefined) {
		throw new Error("Missing merge decision");
	}
	const assigned = (yield* fleet.reassign(ready.decision.id, "maintainer")).value;
	yield* fleet.upgradeStorage();
	const upgraded = (yield* fleet.restartAndReconcile()).value;
	expect(upgraded.decision?.id).toBe(assigned.decision?.id);
	const documents = yield* fleet.publishedDocuments();
	expect(documents.find((entry) => entry.file === upgraded.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
		{ responseFrom: ["maintainer"], state: "open" },
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
