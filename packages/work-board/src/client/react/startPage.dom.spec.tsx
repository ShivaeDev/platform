import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const PAGE_TITLE = "#doc [data-page-header] > h1";

screenStory.it(
	"starts an empty workspace with steps and copyable template cards",
	[routedScreen({}, "/_board/start")],
	function* ({ findElement, findElements, readText, roles }) {
		yield* eventually(() => expect(readText(PAGE_TITLE)).toBe("Start your workspace"));
		expect(findElements("main ol li").map((step) => step.textContent)).toEqual([
			"Copy a template below.",
			"Save it in this folder under the suggested name.",
			"Change the example IDs to your own, and update the links that use them.",
			"Fill in the real details. Start with the goal, then the investigation and the report.",
		]);
		const cards = findElements(".start-template");
		expect(cards.map((card) => card.querySelector("h2")?.textContent)).toEqual(["Goal", "Investigation", "Report"]);
		expect(readText(".start-template [data-slot='card-description']")).toBe("Save as goal.md");
		yield* roles.click({ name: "Copy goal template", role: "button" });
		yield* eventually(() => expect(readText(".start-template [data-copy-status]")).toBe("Copied. Save it as goal.md."));
		const template = findElement<HTMLTextAreaElement>("#template-goal\\.md");
		expect(yield* Effect.promise(() => navigator.clipboard.readText())).toBe(template?.value);
	},
);
