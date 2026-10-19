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
		yield* Effect.promise(() => eventually(() => expect(findElement('[data-context-group="linked-from"] h4')).not.toBeNull()));
		const linksTo = findElement('[data-context-group="links-to"]');
		const linkedFrom = findElement('[data-context-group="linked-from"]');
		expect(readText("h3", linksTo)).toBe("Links to");
		expect(readText("h3", linkedFrom)).toBe("Linked from");
		expect(findElements("h4", linksTo).map((node) => node.textContent)).toEqual(["Depends on", "Implements", "Informs", "Related to"]);
		expect(readText('[data-source-group="Depends on"] a', linksTo)).toBe("Base");
		expect(
			findElements("h4", linkedFrom)
				.map((node) => node.textContent ?? "")
				.sort(),
		).toEqual([
			"Agent handoff (1)",
			"Implemented by (1)",
			"Informed by (1)",
			"Listed in (1)",
			"Needed by (1)",
			"Related to (1)",
			"Reviewed question (1)",
		]);
		expect(readText('[data-source-group="Needed by"] a', linkedFrom)).toBe("Later");
		expect(readText('[data-source-group="Implemented by"] a', linkedFrom)).toBe("Build");
		expect(
			findElements('[data-context-group="links-to"], [data-slot="separator"], [data-context-group="linked-from"]').map(
				(node) => node.dataset.contextGroup ?? node.dataset.slot,
			),
		).toEqual(["links-to", "separator", "linked-from"]);
		for (const label of [...findElements("h4", linksTo), ...findElements("h4", linkedFrom)]) {
			expect([...label.classList]).toEqual(expect.arrayContaining(["text-xs", "text-muted-foreground"]));
		}
		for (const link of [...findElements("a", linksTo), ...findElements("a", linkedFrom)]) {
			expect([...link.classList]).toEqual(expect.arrayContaining(["underline", "underline-offset-4", "pointer-coarse:min-h-11"]));
		}
	},
);

screenStory.it(
	"lists a board's declared items under Links to",
	[boardScreen(relationshipsFixture, (api) => <QueryDocument api={api} url="/board.md" />)],
	function* ({ findElement, findElements, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement('[data-context-group="links-to"]')).not.toBeNull()));
		const linksTo = findElement('[data-context-group="links-to"]');
		expect(findElements("h4", linksTo).map((node) => node.textContent)).toEqual(["Board items"]);
		expect(readText('[data-source-group="Board items"] a', linksTo)).toBe("Task");
	},
);

screenStory.it(
	"lists a link whose target is not in the workspace under its label, without a link",
	[boardScreen(relationshipsFixture, (api) => <QueryDocument api={api} url="/orphan.md" />)],
	function* ({ findElement, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement('[data-context-group="links-to"]')).not.toBeNull()));
		const linksTo = findElement('[data-context-group="links-to"]');
		expect(readText("li", linksTo)).toBe("Depends on: missing.fixture (unresolved, ambiguous, or unavailable)");
		expect(findElement("a", linksTo)).toBeNull();
	},
);

screenStory.it(
	"leaves Implemented by out of a project's incoming links",
	[boardScreen(projectLinksFixture, (api) => <QueryDocument api={api} url="/project.md" />)],
	function* ({ findElement, findElements }) {
		yield* Effect.promise(() => eventually(() => expect(findElement('[data-context-group="linked-from"]')).not.toBeNull()));
		expect(findElements('[data-context-group="linked-from"] h4').map((node) => node.textContent)).toEqual(["Markdown link (1)"]);
	},
);
