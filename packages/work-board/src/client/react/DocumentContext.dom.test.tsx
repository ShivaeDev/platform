import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { recordSourceFixture } from "#test/recordSourceFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

for (const { file, source, explanation } of recordSourceFixture) {
	screenStory.it(
		`keeps ${file} record explanations in the initially hidden Source tab`,
		[routedScreen({ [file]: source }, `/${file}`)],
		function* ({ control, routed, click }) {
			const view = routed();

			yield* Effect.promise(() => eventually(() => expect(view.container.querySelector('[aria-label="Document source"]')).not.toBeNull()));
			const records = control('[aria-label="Document source"]', HTMLElement);
			expect(records.textContent).toContain(explanation);
			expect(records.closest("[hidden]")).not.toBeNull();
			expect(control('.item-context [role="tab"][aria-selected="true"]', HTMLElement).textContent).toBe("Details");
			const sourceTab = [...view.container.querySelectorAll<HTMLButtonElement>('.item-context [role="tab"]')].find(
				(tab) => tab.textContent === "Source",
			);
			click(sourceTab);
			expect(records.closest("[hidden]")).toBeNull();
		},
	);
}
