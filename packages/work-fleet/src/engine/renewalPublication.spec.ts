import { describe, expect } from "@effect/vitest";
import { decisionPublicationFailsOnce } from "#test/engineLaunchTraits.ts";
import { engine } from "#test/engineStory.ts";
import { noChangeReported } from "#test/engineTraits.ts";

describe("renewal retains unresolved decision publication", () => {
	engine.it(
		"a lost context decision publication recovers its revised brief before archival",
		[noChangeReported(), decisionPublicationFailsOnce()],
		function* (fleet) {
			yield* fleet.prepareWork("one");
			yield* fleet.dispatch("one");
			fleet.finishWorkers();
			fleet.editWork("one", "board-one-next");
			expect((yield* fleet.reconcile("one")).value.decisionPublished).toBe(false);
			fleet.approveWork("one", "board-one-next");
			const renewed = yield* fleet.prepareWork("one");
			expect(renewed.value.step).toBe("queued");
			expect(renewed.value.boardRevision).toBe("board-one-next");
			expect(renewed.value.history?.[0]?.decision?.published?.workRevision).toBe("board-one-next");
			expect(renewed.value.history?.[0]?.decisionAcknowledged).toBe(true);
			expect(fleet.launches()).toEqual(["operation-1"]);
		},
	);
});
