import { Cause, Effect, Exit } from "effect";
import { expect } from "vitest";
import { duplicateSave, hiddenSave, roleScreen } from "#test/roleScreen.ts";

roleScreen.it("clicks the labelled button instead of its unlabelled twin", [], function* ({ click, text, story }) {
	yield* click({ name: "Save", role: "button" });
	expect(text({ name: "Result", role: "status" })).toBe("Saved");
	expect(story.lines).toEqual(['click button named "Save"', 'read status named "Result": "Saved"']);
});

roleScreen.it("enters a labelled field and submits its named form", [], function* ({ enter, value, submit, text, story }) {
	yield* enter({ name: "Email", role: "textbox" }, "alice@example.test");
	expect(value({ name: "Email", role: "textbox" })).toBe("alice@example.test");
	yield* submit({ name: "Profile", role: "form" });
	expect(text({ name: "Result", role: "status" })).toBe("Submitted alice@example.test");
	expect(story.lines).toContain('enter a value in textbox named "Email"');
	expect(story.lines).toContain('read the value in textbox named "Email": "alice@example.test"');
	expect(story.lines).toContain('submit form named "Profile"');
});

roleScreen.it("matches an accessible name with a regular expression", [], function* ({ click, text }) {
	yield* click({ name: /^save$/iu, role: "button" });
	expect(text({ name: /result/iu, role: "status" })).toBe("Saved");
});

for (const style of ["display: none", "visibility: hidden", "visibility: collapse", "content-visibility: hidden", "hidden", "aria-hidden"]) {
	for (const ancestor of [false, true]) {
		roleScreen.it(`ignores a matching button ${ancestor ? "inside" : "with"} ${style}`, [hiddenSave(style, ancestor)], function* ({ click, text }) {
			yield* click({ name: "Save", role: "button" });
			expect(text({ name: "Result", role: "status" })).toBe("Saved");
		});
	}
}

roleScreen.it("names the missing role and name and lists visible candidates", [hiddenSave("aria-hidden", true)], function* ({ click, text, value }) {
	const exit = yield* Effect.exit(click({ name: "Missing", role: "button" }));
	const message = Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "clicked";
	expect(message).toContain('0 matches for button named "Missing"');
	expect(message).toContain(
		'Candidates on screen:\n  - button named "Save"\n  - button named ""\n  - form named "Profile"\n  - textbox named "Email"\n  - status named "Result"',
	);
	expect(() => text({ name: "Result", role: "heading" })).toThrow('0 matches for heading named "Result"');
	expect(() => value({ name: "email", role: "textbox" })).toThrow('0 matches for textbox named "email"');
});

roleScreen.it("refuses an ambiguous target and lists the candidates", [duplicateSave], function* ({ click }) {
	const exit = yield* Effect.exit(click({ name: "Save", role: "button" }));
	const message = Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "clicked";
	expect(message).toContain('2 matches for button named "Save"');
	expect(message).toContain("Candidates on screen:");
	expect(message.match(/- button named "Save"/gu)).toEqual(['- button named "Save"', '- button named "Save"']);
	expect(message).toContain('textbox named "Email"');
});

roleScreen.it("reads an element's computed accessibility without telling a line", [], ({ accessible, saveButton, story }) => {
	expect(accessible(saveButton())).toEqual({ name: "Save", role: "button" });
	expect(story.lines).toEqual([]);
});
