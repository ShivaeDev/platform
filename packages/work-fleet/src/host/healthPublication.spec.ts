import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { humanMergeRequired } from "#test/engineTraits.ts";
import { publicationStory, publishedBoard } from "#test/publicationStory.ts";

publicationStory.it("publishes an idle scheduler pass from one snapshot without an extra list request", [publishedBoard], function* (fleet) {
	expect(yield* fleet.publications.idlePass()).toBe(1);
	expect((yield* fleet.publications.health()).lastSchedulerPass).toBeGreaterThan(0);
});
publicationStory.it(
	"publishes counts, configured cap, scheduler pass and provider rejection through the shared Board contract",
	[publishedBoard, humanMergeRequired()],
	function* (fleet) {
		expect(yield* fleet.publications.health()).toMatchObject({ concurrency: 8, lastSchedulerPass: null, queued: 0, running: 0 });
		yield* fleet.publications.blockStatus();
		yield* fleet.prepareWork("one");
		expect(yield* fleet.publications.health()).toMatchObject({ queued: 1, running: 0 });
		fleet.publications.restoreStatus();
		yield* fleet.publications.rejectCapacity();
		yield* fleet.schedule();
		const health = yield* fleet.publications.health();
		expect(health).toMatchObject({ concurrency: 8, lastCapacityRejection: { cause: "serverOverloaded" }, queued: 0, running: 1 });
		expect(health.lastSchedulerPass).toBeGreaterThan(0);
		fleet.finishWorkers();
		yield* fleet.schedule();
		expect(yield* fleet.publications.health()).toMatchObject({ running: 0, waiting: { automation: 0, maintainer: 0, orchestrator: 1 } });
		for (const owner of ["maintainer", "automation"] as const) {
			const decision = (yield* fleet.get("one")).value.decision;
			if (decision === undefined) {
				throw new Error("Missing waiting decision");
			}
			yield* fleet.publications.reassign("one", decision.id, owner);
			expect((yield* fleet.publications.health()).waiting).toEqual({
				automation: Number(owner === "automation"),
				maintainer: Number(owner === "maintainer"),
				orchestrator: 0,
			});
		}
	},
);
publicationStory.it("failed health publication leaves execution usable and retries on the next observation", [publishedBoard], function* (fleet) {
	fleet.publications.blockHealth();
	yield* fleet.prepareWork("one");
	yield* fleet.schedule();
	expect((yield* fleet.get("one")).value.step).toBe("working");
	expect(yield* fleet.publications.health().pipe(Effect.flip)).toMatchObject({ kind: "error" });
	expect(yield* fleet.publications.snapshot()).toMatchObject({ concurrency: 8, queued: 0, running: 1 });
	fleet.publications.restoreHealth();
	yield* fleet.schedule();
	expect(yield* fleet.publications.health()).toMatchObject({ concurrency: 8, queued: 0, running: 1 });
});
publicationStory.it("publishes the final PostgreSQL state once after a batch of Fleet calls", [publishedBoard], function* (fleet) {
	yield* fleet.publications.observeWrites();
	const during = yield* fleet.publications.batchLaunch();
	const writesDeferredUntilPassEnds = 0;
	expect(during.writes).toBe(writesDeferredUntilPassEnds);
	const oneFinalPublication = 1;
	expect(fleet.publications.writes()).toBe(oneFinalPublication);
	expect(yield* fleet.publications.health()).toMatchObject({ queued: 0, running: 1 });
});
