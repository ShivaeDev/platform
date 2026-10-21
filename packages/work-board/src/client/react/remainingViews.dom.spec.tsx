import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const files = {
	"home.md": "# Home",
	"result.md":
		"---\nid: result.fixture\nkind: report\nstatus: done\nrelationships:\n - kind: implements\n   target: task.fixture\nevidence:\n - criterion: task.fixture#proof\n   source: task.md\n   outcome: observed\n---\n# A result\n\nReport limitations.\n",
	"task.md":
		"---\nid: task.fixture\nkind: task\nstatus: draft\nnext_action: Check the proof\ncriteria:\n - id: proof\n   text: Show the result\nattention:\n - id: direction\n   kind: decision\n   reason: Choose a direction\n   state: open\n   response_from: [maintainer]\n   unblocks: [task.fixture]\n---\n# A task\n\nTask context.\n",
};
const routes = [
	{ kind: "system", selector: "[data-source=codex]", text: "Source missing", url: "/_board/system" },
	{ kind: "start", selector: ".start-template textarea", text: "example.goal", url: "/_board/start" },
	{ kind: "handoff", selector: "#handoff-form", text: "Agent name", url: "/_board/handoff?item=task.fixture" },
];
for (const { kind, url, selector, text } of routes) {
	screenStory.it(`renders ${kind} from typed queries`, [routedScreen(files, url, undefined)], function* ({ readText, findElement }) {
		yield* Effect.promise(() => eventually(() => expect(readText(selector)).toContain(text)));
		expect(findElement("main")?.dataset.projection).toBe(kind);
	});
}
screenStory.it(
	"updates answer card context while retaining answer text, node and caret",
	[routedScreen({ ...files }, "/_board/item/task.fixture/", { writable: true })],
	function* ({ refreshDocument, selectText, editFile, findElement, readText, readFocus, typeText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#response-form textarea")).not.toBeNull()));
		const body = findElement<HTMLTextAreaElement>("#response-form textarea");
		if (!body) {
			throw new Error("Missing answer textarea");
		}
		typeText(body, "Keep my response");
		selectText(body, 5, 7);
		editFile("task.md", `${files["task.md"]}\nChanged reviewed context.\n`);
		yield* Effect.promise(() => refreshDocument("/_board/item/task.fixture/"));
		yield* Effect.promise(() => eventually(() => expect(readText("article.doc")).toContain("Changed reviewed context")));
		expect(findElement("#response-form textarea")).toBe(body);
		expect(body.value).toBe("Keep my response");
		expect(readFocus()).toBe(body);
		expect([body.selectionStart, body.selectionEnd]).toEqual([5, 7]);
	},
);
screenStory.it("shows Today for an empty workspace", [routedScreen({}, "/", undefined)], function* ({ readText }) {
	yield* Effect.promise(() => eventually(() => expect(readText("h1")).toBe("Today")));
});
