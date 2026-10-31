import { expect } from "vitest";
import { adminScreen, adminScreens } from "#modules/notes/test-support/admin/screens.tsx";

adminScreens.it("the Jobs queue filter displays the shared note queue name", [adminScreen()], function* ({ screenContent }) {
	const content = yield* screenContent();

	expect(
		[...content.querySelectorAll("select option")].map((option) => ({ label: option.textContent, value: option.getAttribute("value") })),
	).toEqual([{ label: "count-note-words", value: "count-note-words" }]);
});
