import { describe, expect } from "@effect/vitest";
import { rejectedWorkerWithoutResult } from "#test/engineLaunchTraits.ts";
import { engine } from "#test/engineStory.ts";
import { humanMergeRequired } from "#test/engineTraits.ts";
import { prepared } from "#test/preparation.ts";

describe("renewal after explicit safe release", () => {
	engine.it(
		"released terminal work restarts a fresh scope without losing human receipts or the old PR backlog",
		[humanMergeRequired()],
		function* (fleet) {
			yield* fleet.prepareWork("one");
			yield* fleet.dispatch("one");
			fleet.finishWorkers();
			const denied = yield* fleet.reconcile("one");
			const decisionId = denied.value.decision?.id ?? "missing";
			const responseId = fleet.respond(decisionId, "release");
			yield* fleet.resolve("one", decisionId, responseId);
			yield* fleet.restart();

			const renewed = yield* fleet.prepare({
				cwd: "/synthetic",
				preparation: prepared({ ownedPaths: ["src/renewed.ts"] }),
				prompt: "Continue work in a disjoint scope",
				workId: "one",
			});
			expect(renewed.value.history?.[0]?.step).toBe("released");
			expect(renewed.value.history?.[0]?.responses?.[0]?.responseId).toBe(responseId);
			expect(renewed.value.responses).toBeUndefined();
			expect((yield* fleet.dispatch("one")).value.step).toBe("working");
		},
	);
	engine.it("a known rejected turn can renew without querying an unaccepted result", [rejectedWorkerWithoutResult()], function* (fleet) {
		yield* fleet.prepareWork("one");
		const rejected = yield* fleet.dispatch("one");
		expect(rejected.value.attempts[0]?.status).toBe("failed");
		expect(rejected.value.attempts[0]?.receipt).toBeUndefined();
		const renewed = yield* fleet.prepareWork("one");
		expect(renewed.value.step).toBe("queued");
		expect(renewed.value.history?.[0]?.attempts[0]).toEqual({ ...rejected.value.attempts[0], sessionCleanupComplete: true });
		expect(fleet.launches()).toHaveLength(1);
	});
	for (const changed of ["scope", "cwd"] as const) {
		engine.it(`a prepared retry renews ownership when its ${changed} changes`, [rejectedWorkerWithoutResult()], function* (fleet) {
			yield* fleet.prepareWork("one");
			const rejected = yield* fleet.dispatch("one");
			const decisionId = rejected.value.decision?.id ?? "missing";
			const retried = yield* fleet.resolve("one", decisionId, fleet.respond(decisionId, "retry"));
			expect(retried.value.step).toBe("queued");
			const renewed = yield* fleet.prepare({
				cwd: changed === "cwd" ? "/different-repository" : retried.value.cwd,
				preparation: changed === "scope" ? prepared({ ownedPaths: ["src/other.ts"] }) : retried.value.preparation,
				prompt: retried.value.prompt,
				workId: "one",
			});
			expect(renewed.value.attempts).toEqual([]);
			expect(renewed.value.history?.[0]?.attempts[0]).toEqual({ ...retried.value.attempts[0], sessionCleanupComplete: true });
			expect(renewed.value.history?.[0]?.responses).toEqual(retried.value.responses);
			expect(fleet.launches()).toHaveLength(1);
		});
	}
	engine.it("a stored legacy preparation without Board snapshots still dispatches after restart", [], function* (fleet) {
		const current = yield* fleet.prepareWork("one");
		const { history: _history, boardContext: _context, boardSourcePath: _source, ...legacy } = current.value;
		yield* fleet.replaceStoredRecord(legacy);
		yield* fleet.restart();
		const restored = yield* fleet.get("one");
		expect(restored.value.history).toBeUndefined();
		expect(restored.value.boardContext).toBeUndefined();
		expect(restored.value.boardSourcePath).toBeUndefined();
		const dispatched = yield* fleet.dispatch("one");
		expect(dispatched.value.step).toBe("working");
		expect(dispatched.value.attempts[0]?.receipt).toBeDefined();
	});
});
