import { expect } from "vitest";
import { refusal, refusalOf } from "#test/attempt.ts";
import { disabledSelect, duplicateText, openDialog, waitScreen } from "#test/waitScreen.tsx";

for (const action of ["Dismiss", "Hide"]) {
	waitScreen.it(`waits for a notice to disappear after ${action}`, [], function* ({ click, startsGone, progress, finished }) {
		yield* startsGone(".notice");
		expect(yield* progress()).toBe("waiting");

		yield* click({ name: action, role: "button" });

		expect(yield* finished()).toBe("succeeded");
	});
}

waitScreen.it("accepts an already absent target", [], function* ({ gone }) {
	expect(yield* refusal(gone("#absent"))).toBe("succeeded");
});

for (const text of ["Ready now", /^ready now$/iu]) {
	waitScreen.it(`finds visible inline text by ${String(text)}`, [], function* ({ click, startsFindingText, progress, finished }) {
		yield* startsFindingText(text);
		expect(yield* progress()).toBe("waiting");

		yield* click({ name: "Reveal", role: "button" });

		expect(yield* finished()).toBe("ready");
	});
}

waitScreen.it("refuses ambiguous visible text", [duplicateText], function* ({ click, findText }) {
	yield* click({ name: "Reveal", role: "button" });

	expect(yield* refusal(findText("Ready now", { timeout: 30 }))).toBe('died: The screen has 2 matches for text "Ready now".');
});

waitScreen.it("finds an alert by its visible text", [], function* ({ click, find, text }) {
	yield* click({ name: "Reveal", role: "button" });

	const alert = yield* find({ name: "Account saved", role: "alert" });

	expect(alert.textContent).toBe("Account saved");
	expect(text({ name: /account saved/iu, role: "alert" })).toBe("Account saved");
});

waitScreen.it("selects a portalled plan and renders its React change", [openDialog], function* ({ select, text }) {
	expect(text({ name: "Chosen plan", role: "status" })).toBe("free");

	yield* select({ name: "Plan", role: "combobox" }, "team");

	expect(text({ name: "Chosen plan", role: "status" })).toBe("team");
});

waitScreen.it("enters and submits a portalled form", [openDialog], function* ({ enter, submit, text }) {
	yield* enter({ name: "City", role: "textbox" }, "Paris");

	yield* submit({ name: "Preferences form", role: "form" });

	expect(text({ name: "Saved preferences", role: "status" })).toBe("Paris: free");
});

waitScreen.it(
	"finds a portalled dialog and clicks its close button before waiting for removal",
	[openDialog],
	function* ({ find, click, startsGone, finished }) {
		const dialog = { name: "Preferences", role: "dialog" };
		expect((yield* find(dialog)).getAttribute("role")).toBe("dialog");
		yield* startsGone(dialog);

		yield* click({ name: "Close", role: "button" });

		expect(yield* finished()).toBe("succeeded");
	},
);

waitScreen.it("keeps a within scope from reaching an outside portal", [openDialog], function* ({ within }) {
	const main = within("main");

	expect(yield* refusalOf(() => main.text("select"))).toBe('threw: The screen has 0 matches for "select".');
});

waitScreen.it(
	"waits through internal navigation for an OAuth destination",
	[],
	function* ({ startsNavigation, click, progress, finished, location, navigationObserver }) {
		yield* startsNavigation("https://identity.test/authorize");
		yield* click({ name: "Internal page", role: "button" });
		expect(yield* progress()).toBe("waiting");

		yield* click({ name: "Sign in", role: "button" });

		expect(yield* finished()).toBe("succeeded");
		expect(location()).toBe("https://identity.test/authorize?client=screen");
		expect(navigationObserver()).toBe("released");
	},
);

waitScreen.it("recognizes navigation that already happened", [], function* ({ click, navigatedAway }) {
	yield* click({ name: "Sign in", role: "button" });

	expect(yield* refusal(navigatedAway("https://identity.test/authorize"))).toBe("succeeded");
});

waitScreen.it(
	"releases an interrupted navigation wait before another wait",
	[],
	function* ({ startsNavigation, cancelWait, click, navigatedAway, navigationObserver }) {
		yield* startsNavigation("https://unused.test/");
		yield* cancelWait();
		expect(navigationObserver()).toBe("released");

		yield* click({ name: "Sign in", role: "button" });

		expect(yield* refusal(navigatedAway("https://identity.test/authorize"))).toBe("succeeded");
	},
);

waitScreen.it("sees removal of the entire React root", [], function* ({ startsGone, unmount, finished }) {
	yield* startsGone(".notice");

	yield* unmount();

	expect(yield* finished()).toBe("succeeded");
});

waitScreen.it("releases a timed out navigation observer", [], function* ({ navigatedAway, navigationObserver }) {
	yield* refusal(navigatedAway("https://missing.test/", { timeout: 30 }));

	expect(navigationObserver()).toBe("released");
});

for (const [target, value, message, traits] of [
	["select", "missing", 'The screen\'s select has no option "missing".', [openDialog]],
	["input", "team", "The screen's input is not a select.", [openDialog]],
	["select", "team", "The screen's select is disabled.", [disabledSelect, openDialog]],
] as const) {
	waitScreen.it(`refuses selection: ${message}`, traits, function* ({ select }) {
		expect(yield* refusal(select(target, value))).toBe(`died: ${message}`);
	});
}
