import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { createHeldWithLaterEdit, createRestored, creates, createTyped } from "#test/createStories.ts";

creates.it("a reload restores a create draft", [createTyped("New order")], function* ({ name, reload }) {
	yield* reload();

	expect(yield* name()).toBe("New order");
});

creates.it("a successful create resets to the initial input and clears the stored draft", [createRestored()], function* ({ name, stored, submit }) {
	yield* submit();

	yield* outcomes({
		name: [name(), "Paper"],
		stored: [stored(), "none"],
	});
});

creates.it("an edit made during a create survives the reset and stays stored", [createHeldWithLaterEdit()], function* ({ finishSave, name, stored }) {
	yield* finishSave();

	yield* outcomes({
		name: [name(), "Later edit"],
		stored: [stored(), "Later edit"],
	});
});

for (const form of ["create adapter", "direct hook"] as const) {
	for (const [session, kept] of [
		["first", true],
		["second", false],
	] as const) {
		creates.it(
			`a ${form} draft ${kept ? "stays" : "is dropped"} when the ${session} session is shown`,
			[createTyped("First session", form)],
			function* ({ name, session: show, stored }) {
				yield* show(session);

				yield* outcomes({
					name: [name(), kept ? "First session" : "Paper"],
					stored: [stored(), kept ? "First session" : "none"],
				});
			},
		);
	}
}
