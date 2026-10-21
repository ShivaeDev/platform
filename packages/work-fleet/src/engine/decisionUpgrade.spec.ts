import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { noChangeReported, requiredChecksFailOnce } from "#test/engineTraits.ts";
import { publishedBoardDecisions } from "#test/publishedBoardDecisions.ts";

for (const forgetReceipts of [false, true]) {
	isolatedEngine.it(
		`upgrade closes legacy publications ${forgetReceipts ? "without" : "with"} supersession receipts and preserves the current decision`,
		[publishedBoardDecisions],
		function* (fleet) {
			yield* fleet.prepareWork("one");
			yield* fleet.dispatch("one");
			fleet.finishWorkers();
			const ready = (yield* fleet.reconcile("one")).value;
			const decision = ready.decision;
			if (decision?.published === undefined) {
				throw new Error("Missing merge publication");
			}
			const oldSource = fleet.readBoardWork(decision.published.sourcePath);
			const reassigned = (yield* fleet.reassign("one", decision.id, "maintainer")).value;
			fleet.writeBoardWork(decision.published.sourcePath, oldSource);
			if (forgetReceipts) {
				fleet.forgetReceipts();
			}
			yield* fleet.runUpgrade();
			const documents = fleet.publishedDocuments();
			expect(documents.find((entry) => entry.file === decision.published?.sourcePath)?.parsed.fields.attention).toMatchObject([{ state: "closed" }]);
			expect(documents.find((entry) => entry.file === reassigned.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
				{ state: "open" },
			]);
			const closedSource = fleet.readBoardWork(decision.published.sourcePath);
			yield* fleet.reopenBoard();
			expect(fleet.readBoardWork(decision.published.sourcePath)).toBe(closedSource);
		},
	);
}

for (const code of ["reviewed-pr-ready", "fleet-stale"] as const) {
	isolatedEngine.it(
		`storage upgrade reroutes an existing maintainer ${code} decision on reconciliation`,
		[publishedBoardDecisions],
		function* (fleet) {
			yield* fleet.prepareWork("one");
			yield* fleet.dispatch("one");
			fleet.finishWorkers();
			yield* fleet.reconcile("one");
			if (code === "fleet-stale") {
				fleet.editBrief();
			}
			const ready = (yield* fleet.reconcile("one")).value;
			if (ready.decision === undefined) {
				throw new Error("Missing merge decision");
			}
			const legacy = (yield* fleet.reassign("one", ready.decision.id, "maintainer")).value;
			yield* fleet.legacyAutomaticRouting();
			yield* fleet.upgradeStorage();
			yield* fleet.restart();
			const upgraded = (yield* fleet.reconcile("one")).value;
			expect(upgraded.decision?.code).toBe(code);
			const documents = fleet.publishedDocuments();
			expect(documents.find((entry) => entry.file === legacy.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
				{ state: "closed" },
			]);
			expect(documents.find((entry) => entry.file === upgraded.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
				{ responseFrom: ["orchestrator"], state: "open" },
			]);
		},
	);
}

isolatedEngine.it("storage upgrade preserves an explicit maintainer reassignment", [publishedBoardDecisions], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.dispatch("one");
	fleet.finishWorkers();
	const ready = (yield* fleet.reconcile("one")).value;
	if (ready.decision === undefined) {
		throw new Error("Missing merge decision");
	}
	const assigned = (yield* fleet.reassign("one", ready.decision.id, "maintainer")).value;
	yield* fleet.upgradeStorage();
	yield* fleet.restart();
	const upgraded = (yield* fleet.reconcile("one")).value;
	expect(upgraded.decision?.id).toBe(assigned.decision?.id);
	const documents = fleet.publishedDocuments();
	expect(documents.find((entry) => entry.file === upgraded.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
		{ responseFrom: ["maintainer"], state: "open" },
	]);
});

isolatedEngine.it(
	"upgrade closes the latest published decision after renewal without a replacement",
	[publishedBoardDecisions, noChangeReported(), requiredChecksFailOnce()],
	function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		fleet.finishWorkers();
		const blocked = (yield* fleet.reconcile("one")).value;
		const published = blocked.decision?.published;
		if (published === undefined) {
			throw new Error("Missing failed-check publication");
		}
		const oldSource = fleet.readBoardWork(published.sourcePath);
		fleet.revisePublishedBrief();
		const renewed = (yield* fleet.prepareWork("one")).value;
		expect(renewed.decision).toBeUndefined();
		expect(renewed.history?.[0]?.decisionAcknowledged).toBe(true);
		fleet.writeBoardWork(published.sourcePath, oldSource);
		const before = fleet.publishedDocuments();
		expect(
			before.filter((entry) => entry.parsed.fields.kind === "question" && entry.parsed.fields.question === undefined).map((entry) => entry.file),
		).toEqual([published.sourcePath]);
		expect(before.find((entry) => entry.file === published.sourcePath)?.parsed.fields.attention).toMatchObject([{ state: "open" }]);
		yield* fleet.runUpgrade();
		const after = fleet.publishedDocuments();
		expect(after.find((entry) => entry.file === published.sourcePath)?.parsed.fields.attention).toMatchObject([{ state: "closed" }]);
	},
);
