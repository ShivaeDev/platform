import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { noChangeReported } from "#test/engineTraits.ts";
import { publishedBoardDecisions } from "#test/publishedBoardDecisions.ts";

isolatedEngine.it("a reviewed green PR publishes merge readiness to the orchestrator", [publishedBoardDecisions], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.dispatch("one");
	fleet.finishWorkers();
	const ready = (yield* fleet.reconcile("one")).value;
	expect(ready.review?.verdict).toBe("approved");
	expect(ready.checks?.passed).toBe(true);
	expect(ready.decision?.code).toBe("reviewed-pr-ready");
	const documents = fleet.publishedDocuments();
	expect(documents.find((entry) => entry.file === ready.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
		{ responseFrom: ["orchestrator"], state: "open" },
	]);
});

isolatedEngine.it(
	"reassignment closes the previous published decision and keeps the new decision open",
	[publishedBoardDecisions],
	function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		fleet.finishWorkers();
		const ready = (yield* fleet.reconcile("one")).value;
		const decision = ready.decision;
		if (decision === undefined) {
			throw new Error("Missing merge decision");
		}
		const reassigned = (yield* fleet.reassign("one", decision.id, "maintainer")).value;
		const documents = fleet.publishedDocuments();
		expect(documents.find((entry) => entry.file === decision.published?.sourcePath)?.parsed.fields.attention).toMatchObject([{ state: "closed" }]);
		expect(documents.find((entry) => entry.file === reassigned.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
			{ responseFrom: ["maintainer"], state: "open" },
		]);
	},
);

isolatedEngine.it("changed Board context publishes to the orchestrator and closes merge readiness", [publishedBoardDecisions], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.dispatch("one");
	fleet.finishWorkers();
	const ready = (yield* fleet.reconcile("one")).value;
	fleet.editBrief();
	const changed = (yield* fleet.reconcile("one")).value;
	expect(changed.decision?.reason).toBe("Board context changed");
	const documents = fleet.publishedDocuments();
	expect(documents.find((entry) => entry.file === ready.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
		{ state: "closed" },
	]);
	expect(documents.find((entry) => entry.file === changed.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
		{ responseFrom: ["orchestrator"], state: "open" },
	]);
});

isolatedEngine.it("a changed brief at delivery asks the orchestrator", [publishedBoardDecisions, noChangeReported()], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.dispatch("one");
	fleet.finishWorkers();
	fleet.changeBriefWhenChecksFinish();
	const stopped = (yield* fleet.reconcile("one")).value;
	expect(stopped.decision?.reason).toBe("Board context changed");
	const documents = fleet.publishedDocuments();
	expect(documents.find((entry) => entry.file === stopped.decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
		{ responseFrom: ["orchestrator"], state: "open" },
	]);
});
