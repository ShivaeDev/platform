import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { executing } from "#model.ts";
import { uncertainTurnEvidence } from "#test/engineProviderRetryTraits.ts";
import { engine } from "#test/engineStory.ts";

for (const reason of ["unavailable", "protocol", "ambiguous"] as const) {
	engine.it(
		`uncertain ${reason} evidence cannot authorize automatic or explicit release by its wording`,
		[uncertainTurnEvidence(reason)],
		function* ({ fleet, prepareWork, respond, providerCalls, setBoardStatus }) {
			yield* prepareWork("one");

			yield* fleet.dispatch("one");
			const waiting = yield* fleet.reconcile("one");
			expect(waiting.value.step).toBe("waiting");
			setBoardStatus("one", "done");
			expect((yield* fleet.reconcile("one")).value.step).toBe("waiting");
			const decisionId = waiting.value.decision?.id ?? "missing";
			expect((yield* fleet.resolve("one", decisionId, respond(decisionId, "release")).pipe(Effect.result))._tag).toBe("Failure");
			expect(executing((yield* fleet.get("one")).value)).toBe(true);
			expect(
				providerCalls()
					.filter((call) => call.call === "turn")
					.map((call) => call.operationId),
			).toEqual(["operation-1"]);
		},
	);
}
