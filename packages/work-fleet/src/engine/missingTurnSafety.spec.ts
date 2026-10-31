import { expect } from "@effect/vitest";
import { uncertainTurnEvidence } from "#test/engineProviderRetryTraits.ts";
import { engine } from "#test/engineStory.ts";
import { refusal } from "#test/refusal.ts";

for (const reason of ["unavailable", "protocol", "ambiguous"] as const) {
	engine.it(
		`uncertain ${reason} turn evidence keeps its work waiting when the Board marks it done`,
		[uncertainTurnEvidence(reason)],
		function* ({ fleet, prepareWork, setBoardStatus }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			expect((yield* fleet.reconcile("one")).value.step).toBe("waiting");
			setBoardStatus("one", "done");

			const after = yield* fleet.reconcile("one");

			expect(after.value.step).toBe("waiting");
		},
	);

	engine.it(
		`an explicit release of uncertain ${reason} turn evidence is refused and its turn keeps executing without another launch`,
		[uncertainTurnEvidence(reason)],
		function* ({ executionOf, fleet, prepareWork, providerCalls, respond }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const decisionId = (yield* fleet.reconcile("one")).value.decision?.id ?? "missing";

			const released = yield* refusal(fleet.resolve("one", decisionId, respond(decisionId, "release")));

			expect({
				execution: yield* executionOf("one"),
				released,
				turns: providerCalls()
					.filter(({ call }) => call === "turn")
					.map(({ operationId }) => operationId),
			}).toEqual({
				execution: "executing",
				released: "unavailable: No matching accepted turn is observable; absence does not authorize replay",
				turns: ["operation-1"],
			});
		},
	);
}
