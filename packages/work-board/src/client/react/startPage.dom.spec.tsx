import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const PAGE_TITLE = "#doc [data-page-header] > h1";

screenStory.it(
	"starts an empty workspace with steps and copyable template cards",
	[routedScreen({}, "/_board/start")],
	function* ({ findElement, findElements, readText, roles }) {
		yield* Effect.promise(() => eventually(() => expect(readText(PAGE_TITLE)).toBe("Start your workspace")));
		expect(findElements("main ol li").map((step) => step.textContent)).toEqual([
			"Copy a template below.",
			"Save it in this folder under the suggested name.",
			"Change the example IDs to your own, and update the links that use them.",
			"Fill in the real details. Start with the project, then the investigation and the result.",
		]);
		const cards = findElements(".start-template");
		expect(cards.map((card) => card.querySelector("h2")?.textContent)).toEqual(["Project", "Investigation", "Agent result"]);
		expect(readText(".start-template [data-slot='card-description']")).toBe("Save as project.md");
		yield* roles.click({ name: "Copy project template", role: "button" });
		yield* Effect.promise(() => eventually(() => expect(readText(".start-template [data-copy-status]")).toBe("Copied. Save it as project.md.")));
		const template = findElement<HTMLTextAreaElement>("#template-project\\.md");
		expect(yield* Effect.promise(() => navigator.clipboard.readText())).toBe(template?.value);
	},
);
