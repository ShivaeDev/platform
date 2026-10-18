import { describe, expect } from "@effect/vitest";
import { workerTurnUnavailable } from "#test/engineLaunchTraits.ts";
import { engine } from "#test/engineStory.ts";

describe("launch failure ownership", () => {
	engine.it(
		"provider unavailability after session acknowledgement keeps retries on the existing attempt",
		[workerTurnUnavailable()],
		function* (fleet) {
			yield* fleet.prepareWork("one");
			const failed = yield* fleet.dispatch("one");
			expect(failed.value.stage).toBe("needs-human");
			expect(failed.value.attempts[0]).toMatchObject({ sessionId: "session-operation-1", status: "submitting" });
			const decisionId = failed.value.decision?.id ?? "missing";
			yield* fleet.resolve("one", decisionId, fleet.respond(decisionId, "retry"));
			yield* fleet.restart();

			yield* fleet.dispatch("one");
			const recovered = yield* fleet.reconcile("one");
			expect(recovered.value.stage).toBe("needs-human");
			expect(recovered.value.attempts).toEqual(failed.value.attempts);
			expect(fleet.launches()).toEqual(["operation-1"]);
		},
	);
});
