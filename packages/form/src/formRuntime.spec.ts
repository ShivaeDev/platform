import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { callbackLifetimes, firstSaveInFlight } from "#test/callbackLifetimes.ts";
import { failingRuntime } from "#test/failingRuntime.ts";
import { nativeNames } from "#test/lifecycle.ts";

nativeNames.it("native atom services are available without a supplied runtime", [], function* ({ savedValue, submit }) {
	yield* submit();

	expect(yield* savedValue()).toEqual({ name: "First" });
});

callbackLifetimes.it(
	"resubmitting interrupts the obsolete save and releases its resource while the latest name is saved",
	[firstSaveInFlight(), callbackLifetimes.edited("name", "Second")],
	function* ({ activeResources, interruptedSaves, savedValue, submit }) {
		expect(yield* activeResources()).toEqual(["connection", "save:First"]);

		yield* submit();

		yield* outcomes([
			["interrupted saves", () => interruptedSaves(), ["First"]],
			["active resources", () => activeResources(), ["connection"]],
			["saved name", () => savedValue(), { name: "Second" }],
		]);
	},
);

callbackLifetimes.it(
	"disposing the registry releases the pending save's resource and the runtime's connection",
	[firstSaveInFlight()],
	function* ({ activeResources, disposeRegistry }) {
		expect(yield* activeResources()).toEqual(["connection", "save:First"]);

		yield* disposeRegistry();

		expect(yield* activeResources()).toEqual([]);
	},
);

failingRuntime.it("a failing runtime Layer gives the submission its typed connection failure", [], function* ({ connectionFailure, submit }) {
	yield* submit();

	expect(yield* connectionFailure()).toBe("Save connection is unavailable");
});
