import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { editingNote, notesRoute, saveDefect, screens } from "#modules/notes/test-support/screens.ts";

for (const [screen, button, message] of [
	[notesRoute(), "Add note", "Something went wrong. Try again."],
	[editingNote(), "Save note", "Something went wrong. Try again."],
] as const) {
	screens.it(
		`a defect from ${button} shows the failure host's notice without its cause and keeps the draft`,
		[screen, saveDefect()],
		function* ({ alert, click, draft, enter, settle }) {
			yield* enter("Keep my draft");
			expect(yield* alert()).toBe("no alert");

			yield* click(button);
			yield* settle();

			yield* outcomes([
				["alert", alert, message],
				["draft", draft, "Keep my draft"],
			]);
		},
	);
}
