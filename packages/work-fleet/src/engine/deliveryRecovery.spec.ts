import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { deliveryObservationFailsOnce } from "#test/deliveryObservationFailsOnce.ts";
import { engine } from "#test/engineStory.ts";
import { configured, humanMergeRequired } from "#test/engineTraits.ts";
import { prepared } from "#test/preparation.ts";

describe("Fleet delivery ownership", () => {
	{
		const setup = deliveryObservationFailsOnce();
		engine.it(
			"failed delivery observation retains ownership and recovers without a human retry",
			[setup.given],
			function* ({ fixture, fleet, prepareWork, finishWorkers }) {
				const context = setup.context();
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				finishWorkers();
				const ambiguous = yield* fleet.reconcile("one");
				expect(ambiguous.value.stage).toBe("delivering");
				expect(ambiguous.value.decision).toBeUndefined();
				expect(ambiguous.value.blocker).toContain("observation unavailable");
				expect(ambiguous.value.attentionOwner).toBe("automation");
				context.now = 30_100;
				expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
				expect(fixture.merged).toHaveLength(1);
				expect(fixture.reviews).toHaveLength(1);
			},
		);
	}
	engine.it(
		"safe local release keeps the adopted PR in the foreign backlog without blocking its paths",
		[humanMergeRequired()],
		function* ({ fixture, fleet, prepareWork, finishWorkers, respond }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const denied = yield* fleet.reconcile("one");
			yield* fleet.resolve("one", denied.value.decision?.id ?? "missing", respond(denied.value.decision?.id ?? "missing", "release"));
			expect(yield* fixture.foreignReservations()).toEqual([{ backlog: true, executing: false, owner: "https://example.invalid/pr/one" }]);
			yield* fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: ["src/one.ts"] }), prompt: "Same scope", workId: "two" });
			expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
		},
	);
	engine.it(
		"duplicate operation identity cannot acknowledge the wrong work's turn",
		[configured({ operationCollision: true })],
		function* ({ fixture, fleet, prepareWork }) {
			yield* prepareWork("one");
			yield* prepareWork("two");
			yield* fleet.dispatch("one");
			yield* fleet.dispatch("two");
			expect((yield* fleet.get("two")).value.attempts[0]?.receipt).toBeUndefined();
			expect(fixture.operations.size).toBe(1);
		},
	);
	engine.it("persisted acknowledgement rejects a replacement session or turn identity", [], function* ({ fixture, fleet, prepareWork }) {
		yield* prepareWork("one");
		const submitted = yield* fleet.dispatch("one");
		const attempt = submitted.value.attempts[0];
		expect(attempt).toBeDefined();
		expect(
			yield* Effect.flip(fixture.acknowledgeTurn(attempt?.operationId ?? "missing", { sessionId: "another-session", turnId: "another-turn" })),
		).toMatchObject({ _tag: "SessionFailure", reason: "persistence" });
		expect((yield* fleet.get("one")).value.attempts[0]?.receipt).toEqual(attempt?.receipt);
	});
});
