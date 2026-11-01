import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { labelledSwitchScreen } from "#test-support/labelledSwitchScreen.tsx";
import { screens } from "#test-support/screens.ts";

const SWITCH = '[role="switch"]';
const SWITCH_STATE = '[data-slot="switch-state"]';

for (const [control, selector] of [
	["the switch", SWITCH],
	["its label", "label"],
] as const) {
	screens.it(
		`clicking ${control} turns the Email notifications switch on and keeps its accessible name`,
		[labelledSwitchScreen("Email notifications")],
		function* ({ accessible, clickControl, controlText }) {
			expect(controlText(SWITCH_STATE)).toBe("Off");

			yield* clickControl(selector);

			yield* outcomes([
				["visible state", () => Effect.sync(() => controlText(SWITCH_STATE)), "On"],
				["accessible switch", () => Effect.sync(() => accessible(SWITCH)), { name: "Email notifications", role: "switch" }],
			]);
		},
	);
}
