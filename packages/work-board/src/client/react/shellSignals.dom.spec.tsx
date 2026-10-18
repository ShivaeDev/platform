import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen, routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

for (const panel of ["Files", "More"]) {
	screenStory.it(
		`dismisses ${panel} when its current destination is selected without a router transition`,
		[screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]), chromeScreen({ "home.md": "# Home" }, "/_board/library")],
		function* ({ click, control, location }) {
			const previousLocation = location();
			if (panel === "Files") {
				click("#sidebar-toggle");
				expect(control("#sidebar", HTMLElement).hidden).toBe(false);
				click("#sidebar #documents-open");
				yield* Effect.promise(() => eventually(() => expect(control("#sidebar", HTMLElement).hidden).toBe(true)));
			} else {
				click('[aria-controls="phone-more"]');
				expect(control("#phone-more", HTMLDialogElement).open).toBe(true);
				click('#phone-more a[href="/_board/library"]');
				yield* Effect.promise(() => eventually(() => expect(control("#phone-more", HTMLDialogElement).open).toBe(false)));
			}
			expect(location()).toBe(previousLocation);
		},
	);
}

const files = { "home.md": "# Home", "notes/plan.md": "# Plan", "other.md": "# Other" };
screenStory.it(
	"closes Files and More on direct router navigation and retains the new recent title",
	[screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]), chromeScreen(files)],
	function* ({ click, control, navigate, readText, editFile, refreshDocument, readTitle }) {
		click("#sidebar-toggle");
		expect(control("#sidebar", HTMLElement).hidden).toBe(false);
		yield* Effect.promise(() => navigate("/other.md"));
		yield* Effect.promise(() => eventually(() => expect(control("#sidebar", HTMLElement).hidden).toBe(true)));
		click('[aria-controls="phone-more"]');
		expect(control("#phone-more", HTMLDialogElement).open).toBe(true);
		yield* Effect.promise(() => navigate("/notes/plan.md"));
		yield* Effect.promise(() => eventually(() => expect(control("#phone-more", HTMLDialogElement).open).toBe(false)));
		editFile("notes/plan.md", "# Revised plan");
		yield* Effect.promise(() => refreshDocument("/notes/plan.md"));
		yield* Effect.promise(() => eventually(() => expect(readText('section[aria-label="Recent"] a[aria-current="page"]')).toBe("Revised plan")));
		expect(readTitle()).toBe("Revised plan · Work Board");
	},
);

screenStory.it(
	"restores the passage after DocumentContext reports its outline ready",
	[
		screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]),
		routedScreen({ "notes/plan.md": "# Plan\n\n## Evidence\n\nRead this passage." }, "/notes/plan.md#heading-evidence"),
	],
	function* ({ findElement, readFocus }) {
		yield* Effect.promise(() => eventually(() => expect(findElement('.document-outline a[href="#heading-evidence"]')).not.toBeNull()));
		yield* Effect.promise(() => eventually(() => expect(readFocus()?.id).toBe("heading-evidence")));
	},
);
