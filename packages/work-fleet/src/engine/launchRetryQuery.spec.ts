import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { providerCapacityRejected } from "#test/engineCapacityTraits.ts";
import { engine } from "#test/engineStory.ts";

engine.it(
	"the retry projection sees another writer queue and clear work without restarting the reader",
	[providerCapacityRejected()],
	function* (fleet) {
		yield* fleet.prepareWork("one");
		expect(yield* fleet.hasLaunchRetry()).toBe(false);
		yield* fleet.restart();
		const queued = yield* fleet.dispatch("one");
		expect(queued.value.launchRetry).toBeDefined();
		yield* outcomes([
			["previous has launch retry", () => fleet.previousHasLaunchRetry(), true],
			["has launch retry", () => fleet.hasLaunchRetry(), true],
		]);
		fleet.recoverProvider();
		fleet.advanceTime(30_000);
		const accepted = yield* fleet.dispatch("one");
		expect(accepted.value.attempts.at(-1)?.receipt).toBeDefined();
		expect(yield* fleet.previousHasLaunchRetry()).toBe(false);
	},
);
