import { expect } from "vitest";
import { attempt, refusalOf } from "#test/attempt.ts";
import { duplicateSave, hiddenSave, refusedTarget, roleScreen } from "#test/roleScreen.ts";

const SAVE = { name: "Save", role: "button" } as const;
const EMAIL = { name: "Email", role: "textbox" } as const;
const RESULT = { name: "Result", role: "status" } as const;

roleScreen.it("clicks the labelled button instead of its unlabelled twin", [], function* ({ click, text }) {
	yield* click(SAVE);

	expect(text(RESULT)).toBe("Saved");
});

roleScreen.it("enters a value in a labelled field", [], function* ({ enter, value }) {
	yield* enter(EMAIL, "alice@example.test");

	expect(value(EMAIL)).toBe("alice@example.test");
});

roleScreen.it("submits a named form", [], function* ({ enter, submit, text }) {
	yield* enter(EMAIL, "alice@example.test");

	yield* submit({ name: "Profile", role: "form" });

	expect(text(RESULT)).toBe("Submitted alice@example.test");
});

roleScreen.it("tells each action and readout by its target's role and name", [], function* ({ click, enter, story, submit, text, value }) {
	yield* click(SAVE);
	text(RESULT);
	yield* enter(EMAIL, "alice@example.test");
	value(EMAIL);
	yield* submit({ name: "Profile", role: "form" });

	expect(story.lines).toEqual([
		'click button named "Save"',
		'read status named "Result": "Saved"',
		'enter a value in textbox named "Email"',
		'read the value in textbox named "Email": "alice@example.test"',
		'submit form named "Profile"',
	]);
});

roleScreen.it("matches an accessible name with a regular expression", [], function* ({ click, text }) {
	yield* click({ name: /^save$/iu, role: "button" });

	expect(text({ name: /result/iu, role: "status" })).toBe("Saved");
});

for (const style of ["display: none", "visibility: hidden", "visibility: collapse", "content-visibility: hidden", "hidden", "aria-hidden"]) {
	for (const ancestor of [false, true]) {
		roleScreen.it(`ignores a matching button ${ancestor ? "inside" : "with"} ${style}`, [hiddenSave(style, ancestor)], function* ({ click, text }) {
			yield* click(SAVE);

			expect(text(RESULT)).toBe("Saved");
		});
	}
}

roleScreen.it("names the missing role and name and lists the visible candidates", [hiddenSave("aria-hidden", true)], function* ({ click }) {
	expect(yield* attempt(click({ name: "Missing", role: "button" }))).toBe(refusedTarget('0 matches for button named "Missing"'));
});

for (const [readout, target, refusal] of [
	["text", { name: "Result", role: "heading" }, 'threw: The screen has 0 matches for heading named "Result".'],
	["value", { name: "email", role: "textbox" }, 'threw: The screen has 0 matches for textbox named "email".'],
] as const) {
	roleScreen.it(`refuses to read the ${readout} of a role and name nothing on screen has`, [], function* ({ text, value }) {
		expect(yield* refusalOf(() => ({ text, value })[readout](target))).toBe(refusal);
	});
}

roleScreen.it("refuses an ambiguous target and lists both matches among the candidates", [duplicateSave], function* ({ click }) {
	expect(yield* attempt(click(SAVE))).toBe(refusedTarget('2 matches for button named "Save"', '  - button named "Save"'));
});

roleScreen.it("reads an element's computed accessibility", [], ({ accessible, saveButton }) => {
	expect(accessible(saveButton())).toEqual({ name: "Save", role: "button" });
});

roleScreen.it("tells no line when it reads an element's accessibility", [], ({ accessible, saveButton, story }) => {
	accessible(saveButton());

	expect(story.lines).toEqual([]);
});
