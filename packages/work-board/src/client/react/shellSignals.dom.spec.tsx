import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen, routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

for (const panel of ["Sidebar", "More"]) {
	screenStory.it(
		`dismisses ${panel} when its current destination is selected without a router transition`,
		[screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]), chromeScreen({ "home.md": "# Home" }, "/_board/library")],
		function* ({ click, control, findElement, location }) {
			const previousLocation = location();
			if (panel === "Sidebar") {
				click("#sidebar-toggle");
				expect(control("#sidebar", HTMLElement).hidden).toBe(false);
				click("#sidebar #documents-open");
				yield* eventually(() => expect(control("#sidebar", HTMLElement).hidden).toBe(true));
			} else {
				click('[aria-controls="phone-more"]');
				expect(findElement("#phone-more", document)).not.toBeNull();
				click('#phone-more a[href="/_board/library"]');
				yield* eventually(() => expect(findElement("#phone-more", document)).toBeNull());
			}
			expect(location()).toBe(previousLocation);
		},
	);
}

const files = { "home.md": "# Home", "notes/plan.md": "# Plan", "other.md": "# Other" };
screenStory.it(
	"closes the sidebar and More on direct router navigation and retains the new recent title",
	[screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]), chromeScreen(files)],
	function* ({ click, control, findElement, navigate, readText, editFile, refreshDocument, readTitle }) {
		click("#sidebar-toggle");
		expect(control("#sidebar", HTMLElement).hidden).toBe(false);
		yield* Effect.promise(() => navigate("/other.md"));
		yield* eventually(() => expect(control("#sidebar", HTMLElement).hidden).toBe(true));
		click('[aria-controls="phone-more"]');
		expect(findElement("#phone-more", document)).not.toBeNull();
		yield* Effect.promise(() => navigate("/notes/plan.md"));
		yield* eventually(() => expect(findElement("#phone-more", document)).toBeNull());
		editFile("notes/plan.md", "# Revised plan");
		yield* Effect.promise(() => refreshDocument("/notes/plan.md"));
		yield* eventually(() => expect(readTitle()).toBe("Revised plan · Work Board"));
		yield* Effect.promise(() => navigate("/other.md"));
		yield* eventually(() => expect(readText('section[aria-label="Recent"] a[href="/notes/plan.md"]')).toBe("Revised plan"));
	},
);

screenStory.it(
	"restores the passage after DocumentContext reports its outline ready",
	[
		screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]),
		routedScreen({ "notes/plan.md": "# Plan\n\n## Evidence\n\nRead this passage." }, "/notes/plan.md#heading-evidence"),
	],
	function* ({ findElement, readFocus }) {
		yield* eventually(() => expect(findElement('.document-outline a[href="#heading-evidence"]')).not.toBeNull());
		yield* eventually(() => expect(readFocus()?.id).toBe("heading-evidence"));
	},
);
