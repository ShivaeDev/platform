import { expect } from "@effect/vitest";
import { providerCapacityRejected } from "#test/engineCapacityTraits.ts";
import { engine } from "#test/engineStory.ts";

engine.it(
	"provider capacity retry persists automation ownership across restart and clears it after acceptance",
	[providerCapacityRejected()],
	function* (fleet) {
		yield* fleet.prepareWork("one");
		const queued = (yield* fleet.dispatch("one")).value;
		expect(queued).toMatchObject({ attentionOwner: "automation", launchRetry: { retryAt: 30_100 }, stage: "prepared" });
		expect(queued.decision).toBeUndefined();
		yield* fleet.restart();
		expect((yield* fleet.get("one")).value.attentionOwner).toBe("automation");

		const waiting = yield* fleet.rpcViews();
		expect(waiting.waiting.automation).toMatchObject([{ attentionOwner: "automation", stage: "prepared", workId: "one" }]);
		expect(waiting.waiting.automation[0]?.blocker).toContain("Waiting for provider capacity");
		expect(waiting.waiting.maintainer).toEqual([]);
		expect(waiting.waiting.orchestrator).toEqual([]);
		expect(waiting.active).toEqual([]);
		fleet.recoverProvider();
		fleet.advanceTime(30_099 - fleet.currentTime());
		expect((yield* fleet.dispatch("one")).value.attentionOwner).toBe("automation");
		expect(fleet.launches()).toHaveLength(1);
		fleet.advanceTime(30_100 - fleet.currentTime());
		const accepted = (yield* fleet.dispatch("one")).value;
		expect(accepted.stage).toBe("executing");
		expect(accepted.launchRetry).toBeUndefined();
		expect(accepted.attentionOwner).toBeUndefined();
		const active = yield* fleet.rpcViews();
		expect(active.active).toMatchObject([{ stage: "executing", workId: "one" }]);
		expect(active.waiting.automation).toEqual([]);
		expect(fleet.launches()).toHaveLength(2);
	},
);
