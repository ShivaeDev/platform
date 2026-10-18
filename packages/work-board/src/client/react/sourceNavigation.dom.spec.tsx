import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { attentionFixture } from "#test/attentionFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const SOURCE = "/attention/review.md#attention-request-keyboard-review";

for (const { mode, url } of [
	{ mode: "direct", url: SOURCE },
	{ mode: "search", url: "/attention/review.md" },
	{ mode: "same-document", url: "/attention/review.md" },
]) {
	screenStory.it(
		`reveals and focuses an attention source passage through ${mode} navigation`,
		[routedScreen(attentionFixture(), url)],
		function* ({ click, input, control, navigate, findElement, readFocus, readAttribute, back }) {
			if (mode === "search") {
				yield* Effect.promise(() => eventually(() => expect(findElement(".item-summary")).not.toBeNull()));
				click("#search-open");
				input('#search-dialog [role="combobox"]', "keyboard-review");
				const result = '#search-dialog [role="option"] a[href$="#attention-request-keyboard-review"]';
				yield* Effect.promise(() => eventually(() => expect(findElement(result, document)).not.toBeNull()));
				click(result);
			}
			if (mode === "same-document") {
				yield* Effect.promise(() => eventually(() => expect(findElement(".item-summary")).not.toBeNull()));
				expect(control('.item-context [role="tab"][aria-selected="true"]', HTMLElement).textContent).toBe("Details");
				yield* Effect.promise(() => navigate(SOURCE));
			}
			yield* Effect.promise(() => eventually(() => expect(readFocus()?.id).toBe("attention-request-keyboard-review")));
			const target = control("#attention-request-keyboard-review", HTMLElement);
			expect(target.closest("[hidden]")).toBeNull();
			expect(target.closest('[role="tabpanel"]')?.getAttribute("aria-labelledby")).toBe(
				control('.item-context [role="tab"][aria-selected="true"]', HTMLElement).id,
			);
			expect(control('.item-context [role="tab"][aria-selected="true"]', HTMLElement).textContent).toBe("Source");
			yield* Effect.promise(() => navigate("/decision.md"));
			yield* Effect.promise(() => eventually(() => expect(readAttribute("main", "data-route")).toBe("/decision.md")));
			yield* Effect.promise(() => back());
			yield* Effect.promise(() =>
				eventually(() => expect(control("#attention-request-keyboard-review", HTMLElement).closest("[hidden]")).toBeNull()),
			);
			expect(control('.item-context [role="tab"][aria-selected="true"]', HTMLElement).textContent).toBe("Source");
		},
	);
}
