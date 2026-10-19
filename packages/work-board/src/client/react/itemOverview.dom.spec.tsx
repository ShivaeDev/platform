import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { QueryDocument } from "#test/QueryDocument.tsx";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";

screenStory.it(
	"shows criteria on load, resolved target status and backlinks counted by kind, with source in its own tab",
	[
		boardScreen(
			{
				"board.md": "---\nid: board.fixture\nkind: board\nitems: [task.fixture]\n---\n# Board",
				"goal.md": "---\nid: goal.fixture\nkind: goal\nstatus: blocked\ncriteria:\n  - id: design\n    text: Design\n---\n# Ship the feature",
				"notes.md": "# Notes\n\n[Task](task.md)",
				"one.md": "---\nid: report.one\nstatus: done\nrelationships:\n  - kind: informs\n    target: task.fixture\n---\n# One",
				"task.md":
					"---\nid: task.fixture\nkind: task\nrelationships:\n  - kind: implements\n    target: goal.fixture#design\ncriteria:\n  - id: proof\n    text: Visible without a click\n---\n# Readable task\n\nBody.",
				"two.md": "---\nid: report.two\nstatus: planned\nrelationships:\n  - kind: informs\n    target: task.fixture\n---\n# Two",
			},
			(api) => <QueryDocument api={api} url="/task.md" />,
		),
	],
	function* ({ click, readText, findElement, readAttribute, findElements }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#criterion-proof")).toContain("Visible without a click")));
		const criterion = findElement("#criterion-proof");
		expect(criterion?.closest("details")).toBeNull();
		expect(criterion?.closest("[hidden]")).toBeNull();
		expect(readText(".item-introduction h1")).toBe("Readable task");
		expect(findElement(".item-introduction")?.classList.contains("sticky")).toBe(true);
		const relationships = findElement('[data-context-group="links-to"]');
		expect(relationships?.textContent).toContain("Ship the feature");
		expect(readText("[data-status-token]", relationships)).toBe("Blocked");
		expect(readAttribute("a", "href", relationships)).toBe("/_board/item/goal.fixture/#criterion-design");
		expect([...findElements(".work-context h4")].map((node) => node.textContent).sort((a, b) => (a ?? "").localeCompare(b ?? ""))).toEqual([
			"Informed by (2)",
			"Listed in (1)",
			"Markdown link (1)",
		]);
		const backlinks = findElement('[data-context-group="linked-from"] [data-source-group="Informed by"]');
		expect([...(findElements("a", backlinks) ?? [])].map((node) => node.textContent)).toEqual(["One", "Two"]);
		expect([...(findElements("[data-status-token]", backlinks) ?? [])].map((node) => node.textContent)).toEqual(["Done", "Planned"]);
		expect(readAttribute("a", "title", backlinks)).toBe("one.md:6");
		expect(readText('[data-context-group="linked-from"] [data-source-group="Markdown link"] a')).toBe("Notes");
		expect(readText()).not.toContain("Context and tools");
		expect(readText()).not.toContain("Status (source)");
		expect(readText()).not.toContain("Recorded work ·");
		const source = findElement("[data-document-source]");
		expect(source?.closest("[hidden]")).not.toBeNull();
		click(findElement<HTMLButtonElement>('[role="tab"]:nth-child(2)'));
		expect(source?.closest("[hidden]")).toBeNull();
		expect(readText("code", source)).toContain("task.md:");
		expect(readText("pre", source)).toContain("id: task.fixture");
	},
);
