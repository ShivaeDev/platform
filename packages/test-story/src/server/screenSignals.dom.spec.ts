import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import type { ScreenDriver } from "#screenDriver.ts";
import { refusal } from "#test/attempt.ts";
import { screenApp, styledText } from "#test/screenApp.ts";

screenApp.it("waits for held news before reporting a settled screen", [], function* ({ holdNews, click, startsSettling, settling, settled, output }) {
	const news = yield* holdNews();
	yield* click("#load");
	yield* news.waiting;
	yield* startsSettling();
	yield* outcomes({ settling: [settling(), "still settling"], "the output": [output(), "Loading"] });

	yield* news.release;

	yield* outcomes({ "settling": [settled(), "succeeded"], "the output": [output(), "Today's news"] });
});

screenApp.it(
	"keeps settling through identical repaints while news is held",
	[],
	function* ({ holdNews, click, startsSettling, repaints, settling, output }) {
		const news = yield* holdNews();
		yield* click("#load");
		yield* news.waiting;
		yield* startsSettling();

		yield* repaints(20);

		yield* outcomes({ settling: [settling(), "still settling"], "the output": [output(), "Loading"] });
	},
);

screenApp.it("signs in from the form through the fake identity provider", [], function* ({ enter, submit, settle, output }) {
	yield* enter('[name="email"]', "alice@example.test");
	expect(yield* output()).toBe("Ready");

	yield* submit();
	yield* settle();

	expect(yield* output()).toBe("Signed in as alice@example.test");
});

screenApp.it("narrates entering a draft and reading it back", [], function* ({ enter, value, narration }) {
	yield* enter("textarea", "a draft");

	yield* outcomes({
		"the draft": [Effect.sync(() => value("textarea")), "a draft"],
		"the narration": [narration(), ["enter a value in textarea", 'read the value in textarea: "a draft"']],
	});
});

const refusals = [
	["clicking a missing control", ({ click }) => click("#missing"), 'died: The screen has 0 matches for "#missing".'],
	["clicking an ambiguous control", ({ click }) => click("button"), 'died: The screen has 4 matches for "button".'],
	["clicking a disabled button", ({ click }) => click("#unavailable"), "died: The screen's #unavailable is disabled."],
	["entering into a disabled field", ({ enter }) => enter("#disabled-field", "changed"), "died: The screen's #disabled-field is disabled."],
	["clicking a control under an inert ancestor", ({ click }) => click("#inert-control"), "died: The screen's #inert-control is disabled."],
	["entering into a read-only field", ({ enter }) => enter("#readonly", "changed"), "died: The screen's #readonly is read-only."],
	["entering into an output", ({ enter }) => enter("output", "text"), "died: The screen's output is not a text field."],
	["submitting an output", ({ submit }) => submit("output"), "died: The screen's output is not a form."],
] as const satisfies readonly (readonly [string, (driver: ScreenDriver) => Effect.Effect<void>, string])[];

for (const [action, act, refused] of refusals) {
	screenApp.it(`refuses ${action}`, [], function* (verbs) {
		expect(yield* refusal(act(verbs))).toBe(refused);
	});
}

screenApp.it("leaves hidden content out of the screen text", [], function* ({ screenText }) {
	expect(yield* screenText()).toBe("Load newsReady Sign in Inert Unavailable");
});

screenApp.it("reads visible text nodes without layout or CSS transforms", [styledText], ({ text }) => {
	expect(text("#styled")).toBe("FirstSecond");
});

screenApp.it("reports a screen whose news never arrives as unsettled", [], function* ({ holdNews, click, settle }) {
	const news = yield* holdNews();
	yield* click("#load");
	yield* news.waiting;

	expect(yield* refusal(settle({ timeoutMs: 40 }))).toBe("died: The screen did not settle within 40ms.");
});
