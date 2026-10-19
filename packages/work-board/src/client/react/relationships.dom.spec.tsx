import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { QueryDocument } from "#test/QueryDocument.tsx";
import { projectLinksFixture, relationshipsFixture } from "#test/relationshipsFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"labels links from the item's side, with outgoing and incoming links in separate groups",
	[boardScreen(relationshipsFixture, (api) => <QueryDocument api={api} url="/task.md" />)],
	function* ({ findElement, findElements, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement('[aria-label="Linked from"] h4')).not.toBeNull()));
		const linksTo = findElement('[aria-label="Links to"]');
		const linkedFrom = findElement('[aria-label="Linked from"]');
		expect(readText("h3", linksTo)).toBe("Links to");
		expect(readText("h3", linkedFrom)).toBe("Linked from");
		expect(findElements("h4", linksTo).map((node) => node.textContent)).toEqual(["Depends on", "Implements", "Informs", "Related to"]);
		expect(readText('[aria-label="Depends on"] a', linksTo)).toBe("Base");
		expect(
			findElements("h4", linkedFrom)
				.map((node) => node.textContent ?? "")
				.sort(),
		).toEqual([
			"Agent handoff (1)",
			"Implemented by (1)",
			"Informed by (1)",
			"Listed on board (1)",
			"Needed by (1)",
			"Related to (1)",
			"Reviewed question (1)",
		]);
		expect(readText('[aria-label="Needed by backlinks"] a', linkedFrom)).toBe("Later");
		expect(readText('[aria-label="Implemented by backlinks"] a', linkedFrom)).toBe("Build");
		expect(
			findElements('[aria-label="Links to"], [data-slot="separator"], [aria-label="Linked from"]').map(
				(node) => node.getAttribute("aria-label") ?? node.dataset.slot,
			),
		).toEqual(["Links to", "separator", "Linked from"]);
		for (const label of [...findElements("h4", linksTo), ...findElements("h4", linkedFrom)]) {
			expect([...label.classList]).toEqual(expect.arrayContaining(["text-xs", "text-muted-foreground"]));
		}
		for (const link of [...findElements("a", linksTo), ...findElements("a", linkedFrom)]) {
			expect([...link.classList]).toEqual(expect.arrayContaining(["underline", "underline-offset-4", "pointer-coarse:min-h-11"]));
		}
	},
);

screenStory.it(
	"leaves Implemented by out of a project's incoming links",
	[boardScreen(projectLinksFixture, (api) => <QueryDocument api={api} url="/project.md" />)],
	function* ({ findElement, findElements }) {
		yield* Effect.promise(() => eventually(() => expect(findElement('[aria-label="Linked from"]')).not.toBeNull()));
		expect(findElements('[aria-label="Linked from"] h4').map((node) => node.textContent)).toEqual(["Markdown link (1)"]);
	},
);
