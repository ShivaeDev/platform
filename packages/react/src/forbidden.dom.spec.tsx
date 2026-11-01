import { expect } from "vitest";
import { forbiddenScreens } from "#test/forbidden/screens.tsx";

forbiddenScreens.it("the no-access screen uses the application's wording, destination and layout class", [], function* ({ open, page }) {
	yield* open({
		backLabel: "Back to notes",
		children: "Ask your owner for access.",
		className: "no-access",
		title: "Access unavailable",
		to: "/notes",
	});

	expect(yield* page()).toEqual({
		className: "no-access",
		description: "Ask your owner for access.",
		heading: "Access unavailable",
		link: { label: "Back to notes", to: "/notes" },
	});
});
