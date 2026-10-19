import { Cause, Effect, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { deferredSave, duplicateSave, roleScreen } from "#test/roleScreen.ts";

roleScreen.it("waits for a named target to appear and returns its element", [deferredSave], function* ({ find, click, saveButton, story }) {
	const finding = yield* Effect.forkChild(find({ name: "Save", role: "button" }));
	yield* Effect.yieldNow;
	expect(story.lines).toContain('find button named "Save"');
	expect(finding.pollUnsafe()).toBeUndefined();
	yield* click("#twin");
	const found = yield* Fiber.join(finding);
	expect(found).toBe(saveButton());
});

roleScreen.it("finds selectors and regular expression names", [], function* ({ find, saveButton }) {
	const selected = yield* find("#save");
	const named = yield* find({ name: /^save$/iu, role: "button" });
	expect(selected).toBe(saveButton());
	expect(named).toBe(saveButton());
});

roleScreen.it("reports visible candidates when finding a target times out", [], function* ({ find, story }) {
	const exit = yield* Effect.exit(find({ name: "Missing", role: "button" }, { timeout: 40 }));
	const message = Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "found";
	expect(message).toContain('0 matches for button named "Missing"');
	expect(message).toContain('Candidates on screen:\n  - button named "Save"\n  - button named ""');
	expect(message).toContain('textbox named "Email"');
	expect(story.lines).toEqual(['find button named "Missing"']);
});

roleScreen.it("reports both matches and candidates for an ambiguous find", [duplicateSave], function* ({ find }) {
	const exit = yield* Effect.exit(find({ name: "Save", role: "button" }, { timeout: 40 }));
	const message = Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "found";
	expect(message).toContain('2 matches for button named "Save"');
	expect(message).toContain("Candidates on screen:");
	expect(message.match(/- button named "Save"/gu)).toEqual(['- button named "Save"', '- button named "Save"']);
	expect(message).toContain('textbox named "Email"');
});
