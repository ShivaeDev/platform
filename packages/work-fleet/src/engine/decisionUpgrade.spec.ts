import { expect } from "vitest";
import { failedChecks, fleetBoardStory, noChangeReport } from "#test/fleetBoardStory.ts";

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
			yield* fleet.restorePublication(decision.published.sourcePath, oldSource);
			if (forgetReceipts) {
				yield* fleet.forgetReceipts();
			}
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

for (const code of ["reviewed-pr-ready", "fleet-stale"] as const) {
	fleetBoardStory.it(`storage upgrade reroutes an existing maintainer ${code} decision on reconciliation`, [], function* (fleet) {
		yield* fleet.prepare();
		yield* fleet.dispatch();
		fleet.finishWorkers();
		yield* fleet.reconcile();
		if (code === "fleet-stale") {
			yield* fleet.editBrief();
		}
		const ready = (yield* fleet.reconcile()).value;
		if (ready.decision === undefined) {
			throw new Error("Missing merge decision");
		}
		const legacy = (yield* fleet.reassign(ready.decision.id, "maintainer")).value;
		yield* fleet.legacyAutomaticRouting();
		yield* fleet.upgradeStorage();
		yield* fleet.restart();
		const upgraded = (yield* fleet.reconcile()).value;
		expect(upgraded.decision?.code).toBe(code);
		const documents = yield* fleet.publishedDocuments();
		expect(documents.find((entry) => entry.file === legacy.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
			{ state: "closed" },
		]);
		expect(documents.find((entry) => entry.file === upgraded.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
			{ responseFrom: ["orchestrator"], state: "open" },
		]);
	});
}

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
	yield* fleet.restart();
	const upgraded = (yield* fleet.reconcile()).value;
	expect(upgraded.decision?.id).toBe(assigned.decision?.id);
	const documents = yield* fleet.publishedDocuments();
	expect(documents.find((entry) => entry.file === upgraded.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
		{ responseFrom: ["maintainer"], state: "open" },
	]);
});

fleetBoardStory.it(
	"upgrade closes the latest published decision after renewal without a replacement",
	[noChangeReport, failedChecks],
	function* (fleet) {
		yield* fleet.prepare();
		yield* fleet.dispatch();
		fleet.finishWorkers();
		const blocked = (yield* fleet.reconcile()).value;
		const published = blocked.decision?.published;
		if (published === undefined) {
			throw new Error("Missing failed-check publication");
		}
		const oldSource = yield* fleet.readSource(published.sourcePath);
		yield* fleet.reviseBrief();
		const renewed = (yield* fleet.prepare()).value;
		expect(renewed.decision).toBeUndefined();
		expect(renewed.history?.[0]?.decisionAcknowledged).toBe(true);
		yield* fleet.restorePublication(published.sourcePath, oldSource);
		const before = yield* fleet.publishedDocuments();
		expect(before.filter((entry) => entry.parsed.fields.kind === "decision").map((entry) => entry.file)).toEqual([published.sourcePath]);
		expect(before.find((entry) => entry.file === published.sourcePath)?.parsed.fields.attention).toMatchObject([{ state: "open" }]);
		yield* fleet.runUpgrade();
		const after = yield* fleet.publishedDocuments();
		expect(after.find((entry) => entry.file === published.sourcePath)?.parsed.fields.attention).toMatchObject([{ state: "closed" }]);
	},
);
