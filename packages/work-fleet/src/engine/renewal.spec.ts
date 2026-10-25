import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { availableQuota, workerAcknowledgementLost } from "#test/engineLaunchTraits.ts";
import { engine } from "#test/engineStory.ts";
import { humanMergeRequired, noChangeReported } from "#test/engineTraits.ts";
import { prepared } from "#test/preparation.ts";

describe("context-bound Fleet renewal", () => {
	engine.it("terminal context edits renew the same Board ID after restart without promoting old evidence", [noChangeReported()], function* (fleet) {
		yield* fleet.prepareWork("one");
		const first = yield* fleet.dispatch("one");
		fleet.editWork("one", "board-one-next");
		fleet.finishWorkers();
		expect((yield* fleet.reconcile("one")).value.step).toBe("waiting");
		fleet.approveWork("one", "board-one-next");
		yield* fleet.restart();

		const renewed = yield* fleet.prepare({
			cwd: "/synthetic",
			preparation: prepared({ ownedPaths: ["src/one.ts"], validation: [{ command: "new scoped validation", revision: "new-preparation" }] }),
			prompt: "Implement changed context",
			workId: "one",
		});
		expect(renewed.value.workId).toBe("one");
		expect(renewed.value.attempts).toEqual([]);
		expect(renewed.value.history?.[0]?.attempts[0]?.receipt).toEqual(first.value.attempts[0]?.receipt);
		expect(renewed.value.history?.[0]?.boardRevision).toBe("board-one");
		expect(renewed.value.history?.[0]?.decision).toBeDefined();
		expect(renewed.value.preparation.validation).toEqual([{ command: "new scoped validation", revision: "new-preparation" }]);
		expect(renewed.value.result).toBeUndefined();
		expect(renewed.value.review).toBeUndefined();
		expect(renewed.value.checks).toBeUndefined();
		expect(renewed.value.outcome).toBeUndefined();
		expect(renewed.value.decision).toBeUndefined();
		expect((yield* fleet.dispatch("one")).value.step).toBe("working");
		expect(fleet.launches()).toEqual(["operation-1", "operation-2"]);
	});
	engine.it("an authored stop observes the existing terminal turn without resuming before explicit renewal", [noChangeReported()], function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		fleet.editWork("one", "board-one-next");
		const stopped = yield* fleet.reconcile("one");
		expect(stopped.value.decision?.reason).toBe("Board context changed");
		fleet.finishWorkers();
		const observed = yield* fleet.reconcile("one");
		expect(observed.value.step).toBe("waiting");
		expect(observed.value.decision).toEqual(stopped.value.decision);
		expect(observed.value.boardRevision).toBe("board-one");
		expect(observed.value.attempts[0]?.status).toBe("completed");
		expect(
			fleet
				.providerCalls()
				.filter((call) => call.call === "turn")
				.map((call) => call.operationId),
		).toEqual(["operation-1"]);
		fleet.approveWork("one", "board-one-next");
		const renewed = yield* fleet.prepareWork("one");
		expect(renewed.value.step).toBe("queued");
		expect(renewed.value.history?.[0]?.attempts[0]?.receipt).toEqual(stopped.value.attempts[0]?.receipt);
	});
	for (const lostAcknowledgement of [false, true]) {
		engine.it(
			`running or ambiguous submission cannot renew (lost acknowledgement ${lostAcknowledgement})`,
			[workerAcknowledgementLost(lostAcknowledgement)],
			function* (fleet) {
				yield* fleet.prepareWork("one");
				const submitted = yield* fleet.dispatch("one");
				expect(yield* Effect.flip(fleet.prepareWork("one"))).toMatchObject({ _tag: "Forbidden" });
				expect((yield* fleet.get("one")).value.attempts).toEqual(submitted.value.attempts);
				expect((yield* fleet.get("one")).value.history).toBeUndefined();
				expect(fleet.launches()).toEqual(["operation-1"]);
			},
		);
	}
	engine.it("done work renews only a newly approved context and preserves outcome, review and checks", [], function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		fleet.finishWorkers();
		const completed = yield* fleet.reconcile("one");
		expect(completed.value.step).toBe("done");
		expect(completed.value.outcome).toBeDefined();
		expect(completed.value.review).toBeDefined();
		expect(completed.value.checks).toBeDefined();
		expect(yield* Effect.flip(fleet.prepareWork("one"))).toMatchObject({ _tag: "Forbidden" });
		fleet.editWork("one", "board-one-next");
		expect(yield* Effect.flip(fleet.prepareWork("one"))).toMatchObject({ _tag: "Forbidden" });
		fleet.approveWork("one", "board-one-next");
		const renewed = yield* fleet.prepareWork("one");
		expect(renewed.value.step).toBe("queued");
		expect(renewed.value.history?.[0]?.outcome).toEqual(completed.value.outcome);
		expect(renewed.value.history?.[0]?.review).toEqual(completed.value.review);
		expect(renewed.value.history?.[0]?.checks).toEqual(completed.value.checks);
		expect(renewed.value.history?.[0]?.boardContext).toContain("board-one");
		expect(renewed.value.outcome).toBeUndefined();
	});
	engine.it("archiving done attempts does not reset fresh observed quota or permit historic acknowledgement", [availableQuota(2)], function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		fleet.finishWorkers();
		const completed = yield* fleet.reconcile("one");
		fleet.editWork("one", "board-one-next");
		fleet.approveWork("one", "board-one-next");
		yield* fleet.prepareWork("one");
		const prior = completed.value.attempts[0];
		if (prior?.receipt === undefined) {
			return yield* Effect.die("The done worker has no accepted receipt");
		}
		expect(yield* Effect.flip(fleet.acknowledgeProviderTurn(prior.operationId, prior.receipt))).toMatchObject({
			_tag: "SessionFailure",
			reason: "persistence",
		});
		expect(yield* Effect.flip(fleet.dispatch("one"))).toMatchObject({ _tag: "Forbidden" });
		expect(fleet.launches()).toEqual(["operation-1", "operation-2"]);
		expect((yield* fleet.get("one")).value.attempts).toEqual([]);
	});
	engine.it("renewal conserves an adopted open PR backlog reservation and relaunches the same scope", [humanMergeRequired()], function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		fleet.finishWorkers();
		const denied = yield* fleet.reconcile("one");
		const renewed = yield* fleet.prepareWork("one");
		expect(renewed.value.history?.[0]?.resultObservations).toEqual([denied.value.result]);
		expect(renewed.value.history?.[0]?.result).toMatchObject({ kind: "change", pr: "https://example.invalid/pr/one" });
		expect(yield* fleet.foreignReservations()).toEqual([{ areas: [], backlog: true, executing: false, owner: "https://example.invalid/pr/one" }]);
		expect((yield* fleet.dispatch("one")).value.step).toBe("working");
		expect(fleet.launches()).toEqual(["operation-1", "operation-2", "operation-3"]);
	});
});
