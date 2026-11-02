import { expect } from "vitest";
import { refusal, refusalOf } from "#test/attempt.ts";
import { interactionScreen } from "#test/interactionScreen.tsx";

interactionScreen.it("focuses a named field and narrates the action", [], function* ({ focus, text, narration }) {
	expect(text({ name: "Focus", role: "status" })).toBe("Outside");

	yield* focus({ name: "Name", role: "textbox" });

	expect(narration()).toContain('focus textbox named "Name"');
	expect(text({ name: "Focus", role: "status" })).toBe("Name");
});

interactionScreen.it("blurs a named field and narrates the action", [], function* ({ focus, blur, text, narration }) {
	yield* focus({ name: "Name", role: "textbox" });
	expect(text({ name: "Focus", role: "status" })).toBe("Name");

	yield* blur({ name: "Name", role: "textbox" });

	expect(narration()).toContain('blur textbox named "Name"');
	expect(text({ name: "Focus", role: "status" })).toBe("Outside");
});

interactionScreen.it(
	"dispatches key down and up with modifiers to a named target and narrates the press",
	[],
	function* ({ pressKey, text, narration }) {
		expect(text({ name: "Keys", role: "status" })).toBe("None");

		yield* pressKey({ name: "Name", role: "textbox" }, "Enter", { ctrlKey: true });

		expect(narration()).toContain('press "Enter" on textbox named "Name"');
		expect(text({ name: "Keys", role: "status" })).toBe("down Enter with Control, up Enter with Control");
	},
);

interactionScreen.it("hovers a named target through React and narrates the action", [], function* ({ hover, text, narration }) {
	expect(text({ name: "Hover", role: "status" })).toBe("Away");

	yield* hover({ name: "Help", role: "button" });

	expect(narration()).toContain('hover over button named "Help"');
	expect(text({ name: "Hover", role: "status" })).toBe("Mouse");
	expect(text({ name: "Pointer", role: "status" })).toBe("mouse");
});

for (const action of ["focus", "blur", "pressKey", "hover"] as const) {
	interactionScreen.it(`${action} refuses a missing named target`, [], function* (screen) {
		const target = { name: "Missing", role: "button" };
		const result = yield* refusal(action === "pressKey" ? screen.pressKey(target, "Escape") : screen[action](target));

		expect(result).toBe('died: The screen has 0 matches for button named "Missing".');
	});
}

interactionScreen.it("reads a select's chosen value and option values and labels after selection", [], function* ({ selection, select, narration }) {
	const target = { name: "Destination", role: "combobox" };
	expect(selection(target).value).toBe("lon");

	yield* select(target, "par");

	expect(selection(target)).toEqual({
		options: [
			{ label: "London", value: "lon" },
			{ label: "Paris", value: "par" },
		],
		value: "par",
	});
	expect(narration()).toContain(
		'read the selection in combobox named "Destination": {"options":[{"label":"London","value":"lon"},{"label":"Paris","value":"par"}],"value":"par"}',
	);
});

interactionScreen.it("refuses a selection readout on a text field", [], function* ({ selection }) {
	expect(yield* refusalOf(() => selection({ name: "Name", role: "textbox" }))).toBe('threw: The screen\'s textbox named "Name" is not a select.');
});
