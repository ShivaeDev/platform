import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import type { WorkResult } from "#policy.ts";
import { engine } from "#test/engineStory.ts";
import { observedRenewalResult } from "#test/observedRenewalResult.ts";
import { refusal } from "#test/refusal.ts";

const original: WorkResult = { head: "head-one", kind: "change", paths: ["src/one.ts"], pr: "https://example.invalid/pr/one" };
describe("renewal refreshes adopted open PR ownership", () => {
	engine.it("changed actual scope keeps its PR reservation when renewal is denied", [observedRenewalResult(original)], function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		fleet.finishWorkers();
		expect((yield* fleet.reconcile("one")).value.result).toEqual(original);
		const result = { ...original, paths: ["src/one.ts", "src/two.ts"] };
		fleet.setObservedResult(result);
		fleet.editWork("one", "board-one-next");
		fleet.approveWork("one", "board-one-next");
		const preparedOutcome = yield* refusal(fleet.prepareWork("one"));
		expect(preparedOutcome).toMatch(/^forbidden: .*scope exceeds/u);
		yield* outcomes([
			["one history", () => fleet.get("one").pipe(Effect.map((current) => current.value.history)), undefined],
			[
				"foreign reservations",
				() => fleet.foreignReservations(),
				[{ areas: [], backlog: true, executing: false, owner: "https://example.invalid/pr/one" }],
			],
		]);
		expect(fleet.launches()).toEqual(["operation-1", "operation-2"]);
	});
	engine.it("unknown actual PR ownership retains the previous cycle", [observedRenewalResult(original)], function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		fleet.finishWorkers();
		yield* fleet.reconcile("one");
		fleet.loseResultOwnership();
		fleet.editWork("one", "board-one-next");
		fleet.approveWork("one", "board-one-next");
		expect(yield* refusal(fleet.prepareWork("one"))).toMatch(/^forbidden: .*ownership is unavailable/u);
		const retained = yield* fleet.get("one");
		expect(retained.value.result).toEqual(original);
		expect(retained.value.history).toBeUndefined();
		expect(retained.value.boardRevision).toBe("board-one");
	});
	engine.it("a different observed PR retains both known owners without archiving", [observedRenewalResult(original)], function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		fleet.finishWorkers();
		yield* fleet.reconcile("one");
		const result = { ...original, paths: ["src/two.ts"], pr: "https://example.invalid/pr/replacement" };
		fleet.setObservedResult(result);
		fleet.editWork("one", "board-one-next");
		fleet.approveWork("one", "board-one-next");
		const renewed = yield* refusal(fleet.prepareWork("one"));
		expect(renewed).toMatch(/^forbidden: .*identity changed/u);
		yield* outcomes([
			["one result", () => fleet.get("one"), { value: { result: original } }],
			[
				"foreign reservation owners",
				() => fleet.foreignReservations().pipe(Effect.map((current) => current.map(({ owner }) => owner))),
				["https://example.invalid/pr/one", "https://example.invalid/pr/replacement"],
			],
		]);
	});
	engine.it(
		"a refreshed head is archived with prior evidence instead of reusing it for new work",
		[observedRenewalResult(original)],
		function* (fleet) {
			yield* fleet.prepareWork("one");
			yield* fleet.dispatch("one");
			fleet.finishWorkers();
			yield* fleet.reconcile("one");
			const result = { ...original, head: "head-updated" };
			fleet.setObservedResult(result);
			fleet.editWork("one", "board-one-next");
			fleet.approveWork("one", "board-one-next");
			const renewed = yield* fleet.prepareWork("one");
			expect(renewed.value.history?.[0]?.result).toEqual(result);
			expect(renewed.value.history?.[0]?.resultObservations).toEqual([original]);
			expect(renewed.value.history?.[0]?.review?.head).toBe("head-one");
			expect(renewed.value.review).toBeUndefined();
			expect(renewed.value.checks).toBeUndefined();
			expect(renewed.value.result).toBeUndefined();
		},
	);
	engine.it("guided release keeps the observed PR backlog reservation", [observedRenewalResult(original)], function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		fleet.finishWorkers();
		const denied = yield* fleet.reconcile("one");
		const result = { ...original, paths: ["src/one.ts", "src/two.ts"] };
		fleet.setObservedResult(result);
		expect(yield* refusal(fleet.prepareWork("one"))).toMatch(/^forbidden: /u);
		const decisionId = denied.value.decision?.id ?? "missing";
		const responseId = fleet.respond(decisionId, "release");
		const resolved = yield* fleet.resolve("one", decisionId, responseId);
		expect(resolved.value.step).toBe("released");
		expect(yield* fleet.foreignReservations()).toEqual([{ areas: [], backlog: true, executing: false, owner: "https://example.invalid/pr/one" }]);
	});
});
