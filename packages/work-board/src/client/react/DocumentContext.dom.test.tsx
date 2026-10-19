import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { recordSourceFixture } from "#test/recordSourceFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

for (const { file, source, explanation } of recordSourceFixture) {
	screenStory.it(
		`keeps ${file} record explanations in the Source tab, hidden until the reader opens it and again after Details`,
		[routedScreen({ [file]: source }, `/${file}`)],
		function* ({ control, click, findElement, findElements }) {
			yield* Effect.promise(() => eventually(() => expect(findElement('[aria-label="Document source"]')).not.toBeNull()));
			const records = control('[aria-label="Document source"]', HTMLElement);
			expect(records.textContent).toContain(explanation);
			expect(records.closest("[hidden]")).not.toBeNull();
			expect(control('.item-context [role="tab"][aria-selected="true"]', HTMLElement).textContent).toBe("Details");
			const sourceTab = [...findElements<HTMLButtonElement>('.item-context [role="tab"]')].find((tab) => tab.textContent === "Source");
			click(sourceTab);
			expect(records.closest("[hidden]")).toBeNull();
			click([...findElements<HTMLButtonElement>('.item-context [role="tab"]')].find((tab) => tab.textContent === "Details"));
			expect(control('.item-context [role="tab"][aria-selected="true"]', HTMLElement).textContent).toBe("Details");
			expect(records.closest("[hidden]")).not.toBeNull();
		},
	);
}
