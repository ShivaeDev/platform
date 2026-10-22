import { expect } from "@effect/vitest";
import { engine } from "#test/engineStory.ts";
import { reviewAcknowledgementLost } from "#test/engineTraits.ts";
import { prepared } from "#test/preparation.ts";

engine.it("persists exact worker and reviewer launch inputs, including omitted reviewer settings", [reviewAcknowledgementLost()], function* (fleet) {
	const settings = { model: "task-model", serviceTier: "priority" };
	yield* fleet.prepare({
		cwd: "/synthetic",
		launch: settings,
		preparation: prepared({ ownedPaths: ["src/one.ts"], sourcePaths: ["src/one.ts"] }),
		prompt: "Implement one",
		workId: "one",
	});
	const worker = yield* fleet.dispatch("one");
	expect(worker.value.attempts[0]).toMatchObject({ prompt: "Implement one", settings });
	fleet.finishWorkers();
	const reviewing = yield* fleet.reconcile("one");
	expect(reviewing.value).toMatchObject({ attentionOwner: "orchestrator", decision: { attentionOwner: "orchestrator" } });
	const reviewer = reviewing.value.attempts.at(-1);
	expect(reviewer?.settings).toEqual({});
	expect(reviewer?.prompt).toBe(fleet.providerStarts().at(-1)?.prompt);
	expect(fleet.providerStarts().at(-1)).toMatchObject({ access: "read-only", settings: {} });
	const decisionId = reviewing.value.decision?.id ?? "missing";
	yield* fleet.resolve("one", decisionId, fleet.respond(decisionId, "retry"));
	yield* fleet.restart();
	expect((yield* fleet.reconcile("one")).value.step).toBe("done");
	expect(fleet.launches()).toHaveLength(2);
});
