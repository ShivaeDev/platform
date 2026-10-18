import { Effect } from "effect";
import { act } from "react";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { attentionFixture } from "#test/attentionFixture.ts";
import { control as findControl } from "#test/chrome.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
beforeEach(() => {
	sessionStorage.clear();
	window.history.replaceState({}, "", "/");
});
afterEach(() => vi.restoreAllMocks());

const SOURCE = "/attention/review.md#attention-request-keyboard-review";
function expectSource() {
	const target = findControl("#attention-request-keyboard-review", HTMLElement);
	expect(target.closest("[hidden]")).toBeNull();
	expect(target.closest('[role="tabpanel"]')?.getAttribute("aria-labelledby")).toBe(
		findControl('.item-context [role="tab"][aria-selected="true"]', HTMLElement).id,
	);
	expect(findControl('.item-context [role="tab"][aria-selected="true"]', HTMLElement).textContent).toBe("Source");
}

for (const { mode, url } of [
	{ mode: "direct", url: SOURCE },
	{ mode: "search", url: "/attention/review.md" },
	{ mode: "same-document", url: "/attention/review.md" },
]) {
	screenStory.it(
		`reveals and focuses an attention source passage through ${mode} navigation`,
		[routedScreen(attentionFixture(), url)],
		function* ({ click, input, control, routed, navigate }) {
			const view = routed();

			if (mode === "search") {
				yield* Effect.promise(() => eventually(() => expect(view.container.querySelector(".item-summary")).not.toBeNull()));
				click("#search-open");
				input("#search-query", "keyboard-review");
				const result = '[role="option"][href$="#attention-request-keyboard-review"]';
				yield* Effect.promise(() => eventually(() => expect(view.container.querySelector(result)).not.toBeNull()));
				click(result);
			}
			if (mode === "same-document") {
				yield* Effect.promise(() => eventually(() => expect(view.container.querySelector(".item-summary")).not.toBeNull()));
				expect(control('.item-context [role="tab"][aria-selected="true"]', HTMLElement).textContent).toBe("Details");
				yield* Effect.promise(() => navigate(SOURCE));
			}
			yield* Effect.promise(() => eventually(() => expect(document.activeElement?.id).toBe("attention-request-keyboard-review")));
			expectSource();
			yield* Effect.promise(() => navigate("/decision.md"));
			yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("main")?.getAttribute("data-route")).toBe("/decision.md")));
			yield* Effect.promise(() => act(async () => view.router.history.back()));
			yield* Effect.promise(() => eventually(expectSource));
		},
	);
}
