import { expect } from "vitest";
import { effectPeerMismatch, pinnedApp, unreleasedPin } from "#starter-published/test-support/pinnedApp.ts";

pinnedApp.it("Packed starter rejects tooling incompatible with its published pin even when the workspace accepts it", [], function* ({ check }) {
	expect(yield* check()).toContain("Expected 2 arguments, but got 3");
});

pinnedApp.it(
	"Packed starter rejects npm Effect peers that differ from the starter even when workspace peers match",
	[effectPeerMismatch],
	function* ({ check }) {
		expect(yield* check()).toContain("unmet peer effect");
	},
);

pinnedApp.it("Packed starter accepts an unreleased pin from its matching archive", [unreleasedPin], function* ({ check }) {
	expect(yield* check()).toBe("passed");
});
