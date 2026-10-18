import { expect } from "vitest";
import { labelledSwitchScreen } from "#test-support/labelledSwitchScreen.tsx";
import { screens } from "#test-support/screens.ts";

screens.it(
	"names a labelled switch for its setting while its visible state changes",
	[labelledSwitchScreen("Email notifications")],
	function* ({ accessible, clickControl, controlText }) {
		expect(controlText('[data-slot="switch-state"]')).toBe("Off");
		expect(accessible('[role="switch"]')).toEqual({ name: "Email notifications", role: "switch" });
		yield* clickControl('[role="switch"]');
		expect(controlText('[data-slot="switch-state"]')).toBe("On");
		expect(accessible('[role="switch"]')).toEqual({ name: "Email notifications", role: "switch" });
		yield* clickControl("label");
		expect(controlText('[data-slot="switch-state"]')).toBe("Off");
		expect(accessible('[role="switch"]')).toEqual({ name: "Email notifications", role: "switch" });
	},
);
