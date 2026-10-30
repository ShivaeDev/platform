import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { refusal, refusalOf } from "#test/attempt.ts";
import { hiddenScreen, inertForm, screenApp } from "#test/screenApp.ts";

for (const style of ["display: none", "visibility: hidden", "content-visibility: hidden", "hidden"]) {
	for (const ancestor of [false, true]) {
		screenApp.it(
			`refuses actions and readouts when ${ancestor ? "an ancestor has" : "targets have"} ${style}`,
			[hiddenScreen(style, ancestor)],
			function* ({ accessible, click, enter, submit, text, value }) {
				yield* outcomes({
					"clicking Load news": [refusal(click("#load")), "died: The screen's #load is not rendered."],
					"entering a draft": [refusal(enter("textarea", "draft")), "died: The screen's textarea is not rendered."],
					"entering an email": [refusal(enter('[name="email"]', "alice@example.test")), 'died: The screen\'s [name="email"] is not rendered.'],
					"reading Load news by role": [refusalOf(() => accessible("#load")), "threw: The screen's #load is not rendered."],
					"reading the draft": [refusalOf(() => value("textarea")), "threw: The screen's textarea is not rendered."],
					"reading the email": [refusalOf(() => value('[name="email"]')), 'threw: The screen\'s [name="email"] is not rendered.'],
					"reading the output": [refusalOf(() => text("output")), "threw: The screen's output is not rendered."],
					"reading the screen": [refusalOf(() => text()), ancestor ? "threw: The screen's root is not rendered." : "succeeded"],
					"submitting the form": [refusal(submit()), "died: The screen's form is not rendered."],
				});
			},
		);
	}
}

screenApp.it("refuses submission through an inert ancestor", [inertForm], function* ({ submit }) {
	expect(yield* refusal(submit())).toBe("died: The screen's form is disabled.");
});
