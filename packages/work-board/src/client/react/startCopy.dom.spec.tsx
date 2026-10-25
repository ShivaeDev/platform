import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { deniedClipboard } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const PROJECT = ".start-template:has([data-template-copy='goal.md'])";

screenStory.it(
	"opens and selects a Start template when the clipboard refuses it",
	[deniedClipboard(), routedScreen({ "home.md": "# Home" }, "/_board/start", undefined)],
	function* ({ click, findElement, readFocus, readText }) {
		yield* eventually(() => expect(findElement(`${PROJECT} [data-template-copy]`)).not.toBeNull());
		expect(findElement<HTMLDetailsElement>(`${PROJECT} details`)?.open).toBe(false);
		click(`${PROJECT} [data-template-copy]`);
		yield* eventually(() =>
			expect(readText(`${PROJECT} [data-copy-status]`)).toBe("Couldn't copy automatically. The template is selected, so copy it yourself."),
		);
		const field = findElement<HTMLTextAreaElement>(`${PROJECT} textarea`);
		expect(findElement<HTMLDetailsElement>(`${PROJECT} details`)?.open).toBe(true);
		expect(readFocus()).toBe(field);
		expect([field?.selectionStart, field?.selectionEnd]).toEqual([0, field?.value.length]);
	},
);
