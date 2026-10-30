import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const SOURCE =
	"---\nid: task.fixture\nkind: task\nnext_action: Inspect the proof\nattention:\n - id: direction\n   kind: decision\n   state: open\n   reason: Choose a direction\n   response_from: [maintainer]\n   unblocks: [task.fixture]\n---\n# A task\n\nTask context.\n";
const cases = [
	{ field: '[name="body"]', kind: "response", query: "document" as const, source: SOURCE, url: "/_board/item/task.fixture/", writable: true },
	{
		field: '[data-prompt="answer"] textarea',
		kind: "response",
		query: "document" as const,
		source:
			"---\nid: task.fixture\nkind: question\nscope: task\nurgency: whenever\nstatus: ready\noptions:\n - label: Keep files\n   description: Keep direction local\n---\n# Which direction?\n",
		url: "/_board/item/task.fixture/",
		writable: true,
	},
	{
		field: '[name="body"]',
		kind: "response",
		query: "document" as const,
		source:
			"---\nid: task.fixture\nkind: question\nscope: task\nurgency: whenever\nstatus: ready\noptions:\n - label: Keep files\n   description: Keep direction local\n---\n# Which direction?\n",
		url: "/_board/item/task.fixture/",
		writable: true,
	},
	{ field: '[name="goal"]', kind: "handoff", query: "handoff" as const, source: SOURCE, url: "/_board/handoff?item=task.fixture", writable: false },
];
for (const { kind, query, field, url, source: content, writable } of cases) {
	const files = { "home.md": "# Home", "task.md": content };
	const selector = `#${kind}-form ${field}`;
	screenStory.it(
		`retains ${query} ${field} draft, source notice and caret through query refresh and reload`,
		[screenWorkspace("forms-fixture"), routedScreen(files, url, { writable })],
		function* ({ findElement, readText, readFocus, typeText, selectText, editFile, refreshQuery, browserEvent, closeScreen, renderRouter }) {
			yield* eventually(() => expect(findElement(`#${kind}-form`)).not.toBeNull());
			const original = findElement<HTMLTextAreaElement>(selector);
			typeText(original, "Direction in progress");
			selectText(selector, 4, 9, "backward");
			editFile("task.md", `${content}\nChanged source context.\n`);
			yield* Effect.promise(() => refreshQuery(query, { url }));
			yield* eventually(() => expect(readText(`#${kind}-status`)).toContain("Source changed"));
			expect(findElement(selector)).toBe(original);
			expect(original?.value).toBe("Direction in progress");
			expect(readFocus()).toBe(original);
			expect([original?.selectionStart, original?.selectionEnd, original?.selectionDirection]).toEqual([4, 9, "backward"]);
			browserEvent("pagehide");
			yield* Effect.promise(closeScreen);
			yield* Effect.promise(() => renderRouter(undefined, url));
			yield* eventually(() => expect(readText(`#${kind}-status`)).toContain("Source changed"));
			const restored = findElement<HTMLTextAreaElement>(selector);
			expect(restored?.value).toBe("Direction in progress");
			const details = restored?.closest("details");
			if (details) {
				expect(details.open).toBe(true);
			}
			expect(readFocus()).toBe(restored);
			expect([restored?.selectionStart, restored?.selectionEnd, restored?.selectionDirection]).toEqual([4, 9, "backward"]);
			expect(findElement(`#${kind}-submit`)).toHaveProperty("disabled", !writable);
		},
	);
}
