import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import type { WorkResult } from "#policy.ts";
import { engine } from "#test/engineStory.ts";
import { observedRenewalResult } from "#test/observedRenewalResult.ts";

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
		expect(yield* Effect.flip(fleet.prepareWork("one"))).toMatchObject({ _tag: "Forbidden", message: expect.stringContaining("scope exceeds") });
		expect((yield* fleet.get("one")).value.history).toBeUndefined();
		expect(yield* fleet.foreignReservations()).toEqual([{ areas: [], backlog: true, executing: false, owner: "https://example.invalid/pr/one" }]);
		expect(fleet.launches()).toHaveLength(2);
	});
	engine.it("unknown actual PR ownership retains the previous cycle", [observedRenewalResult(original)], function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		fleet.finishWorkers();
		yield* fleet.reconcile("one");
		fleet.loseResultOwnership();
		fleet.editWork("one", "board-one-next");
		fleet.approveWork("one", "board-one-next");
		expect(yield* Effect.flip(fleet.prepareWork("one"))).toMatchObject({
			_tag: "Forbidden",
			message: expect.stringContaining("ownership is unavailable"),
		});
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
		expect(yield* Effect.flip(fleet.prepareWork("one"))).toMatchObject({ _tag: "Forbidden", message: expect.stringContaining("identity changed") });
		expect((yield* fleet.get("one")).value.result).toEqual(original);
		expect((yield* fleet.foreignReservations()).map(({ owner }) => owner)).toEqual([
			"https://example.invalid/pr/one",
			"https://example.invalid/pr/replacement",
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
		expect(yield* Effect.flip(fleet.prepareWork("one"))).toMatchObject({ _tag: "Forbidden" });
		const decisionId = denied.value.decision?.id ?? "missing";
		const responseId = fleet.respond(decisionId, "release");
		expect((yield* fleet.resolve("one", decisionId, responseId)).value.step).toBe("released");
		expect(yield* fleet.foreignReservations()).toEqual([{ areas: [], backlog: true, executing: false, owner: "https://example.invalid/pr/one" }]);
	});
});
