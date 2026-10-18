import { Effect } from "effect";
import { act } from "react";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen, routedScreen } from "#test/screenTraits.ts";
import { documentQuery, navigationQuery } from "./routeQuery.ts";

expectNoReactWarnings();
beforeEach(() => {
	vi.stubGlobal("matchMedia", (query: string) => ({
		addEventListener: () => undefined,
		matches: query.includes("max-width"),
		removeEventListener: () => undefined,
	}));
});
afterEach(() => vi.unstubAllGlobals());

for (const panel of ["Files", "More"]) {
	screenStory.it(
		`dismisses ${panel} when its current destination is selected without a router transition`,
		[chromeScreen({ "home.md": "# Home" }, "/_board/library")],
		function* ({ click, control, routed }) {
			const view = routed();

			const location = view.router.state.location;
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
			expect(view.router.state.location).toBe(location);
		},
	);
}

screenStory.it(
	"closes Files and More on direct router navigation and retains the new recent title",
	[],
	function* ({ chrome, click, control, navigate }) {
		const files = { "home.md": "# Home", "notes/plan.md": "# Plan", "other.md": "# Other" };
		const view = yield* Effect.promise(() => chrome(files));

		click("#sidebar-toggle");
		expect(control("#sidebar", HTMLElement).hidden).toBe(false);
		yield* Effect.promise(() => navigate("/other.md"));
		yield* Effect.promise(() => eventually(() => expect(control("#sidebar", HTMLElement).hidden).toBe(true)));
		click('[aria-controls="phone-more"]');
		expect(control("#phone-more", HTMLDialogElement).open).toBe(true);
		yield* Effect.promise(() => navigate("/notes/plan.md"));
		yield* Effect.promise(() => eventually(() => expect(control("#phone-more", HTMLDialogElement).open).toBe(false)));
		files["notes/plan.md"] = "# Revised plan";
		act(() => {
			view.registry.refresh(navigationQuery(view.api));
			view.registry.refresh(documentQuery(view.api, "/notes/plan.md"));
		});
		yield* Effect.promise(() =>
			eventually(() => expect(document.querySelector('section[aria-label="Recent"] a[aria-current="page"]')?.textContent).toBe("Revised plan")),
		);
		expect(document.title).toBe("Revised plan · Work Board");
	},
);

screenStory.it(
	"restores the passage after DocumentContext reports its outline ready",
	[routedScreen({ "notes/plan.md": "# Plan\n\n## Evidence\n\nRead this passage." }, "/notes/plan.md#heading-evidence")],
	function* () {
		yield* Effect.promise(() => eventually(() => expect(document.querySelector('.document-outline a[href="#heading-evidence"]')).not.toBeNull()));
		yield* Effect.promise(() => eventually(() => expect(document.activeElement?.id).toBe("heading-evidence")));
	},
);
