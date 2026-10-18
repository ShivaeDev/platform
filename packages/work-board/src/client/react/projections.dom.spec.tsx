import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const files = {
	"home.md":
		"---\nid: board.fixture\nkind: board\nitems: [task.fixture]\n---\n# Project board\n\nIntro.\n\n## Plans\n\nSection note.\n\n### Task\n\n[Read task](task.md)\n\n## Waiting\n\n### Task\n\nSecond card.\n\n---\n\nFooter.\n",
	"question.md": "---\nid: question.fixture\nkind: question\nstatus: open\nowner: reader\n---\n# A question\n\nChoose next.\n",
	"task.md":
		"---\nid: task.fixture\nkind: task\nstatus: planned\nowner: reader\nnext_action: Read evidence\nattention:\n  - id: direction\n    kind: decision\n    reason: Choose a direction\n    state: open\n    response_from: [maintainer]\n    unblocks: [task.fixture]\n---\n# A task\n\nTask details.\n",
};
const routes = [
	{ kind: "today", selector: "#needs-you", text: "A question", url: "/" },
	{ kind: "board", selector: ".board .item", text: "Read task", url: "/home.md" },
	{ kind: "board", selector: ".board .item", text: "Read task", url: "/_board/item/board.fixture/" },
	{ kind: "work", selector: ".work-card[data-item='task.fixture']", text: "A task", url: "/_board/work?view=board" },
	{ kind: "work", selector: ".work-table", text: "A task", url: "/_board/work?view=table&owner=value%3Areader&q=task&item=task.fixture" },
];
for (const { url, selector, text, kind } of routes) {
	screenStory.it(
		`renders ${url} from its typed projection`,
		[routedScreen(files, url, undefined)],
		function* ({ readText, findElement, findElements }) {
			yield* Effect.promise(() => eventually(() => expect(readText(selector)).toContain(text)));
			expect(findElement("main")?.dataset.projection).toBe(kind);
			if (kind === "board") {
				expect(readText(".item-introduction h1")).toBe("Project board");
				expect(findElement(".item-introduction")?.classList.contains("sticky")).toBe(true);
				expect(findElement('.document-outline a[href="#heading-plans"]')).not.toBeNull();
				expect(readText(".board .notes")).toContain("Section note");
				expect(readText(".counts")).toBe("1 plans · 1 waiting");
				expect(readText("footer")).toContain("Footer");
				expect(findElement("#heading-task-2")).not.toBeNull();
				expect(findElement(".item a[href='/task.md']")).not.toBeNull();
			}
			if (url.includes("item=task.fixture")) {
				expect(findElements(".work-table tbody tr")).toHaveLength(1);
				yield* Effect.promise(() => eventually(() => expect(readText("#work-detail article.doc")).toContain("Task details")));
				expect(readText("#work-detail .item-summary")).toContain("Read evidence");
			}
		},
	);
}

screenStory.it(
	"retains inline answer edits and selected detail through a Work projection refresh",
	[routedScreen({ ...files }, "/_board/work?view=board&item=question.fixture&q=task")],
	function* ({ refreshQuery, selectText, findElement, readText, typeText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#response-form textarea")).not.toBeNull()));
		expect(readText(".detail-notice")).toContain("outside the current board or filters");
		const body = findElement<HTMLTextAreaElement>("#response-form textarea");
		if (!body) {
			throw new Error("Missing answer textarea");
		}
		typeText(body, "Keep my answer");
		selectText(body, 5, 7);
		yield* Effect.promise(() => refreshQuery("work", { url: "/_board/work?view=board&item=question.fixture&q=task" }));
		yield* Effect.promise(() =>
			eventually(() => expect(findElement("main")?.dataset.route).toBe("/_board/work?view=board&item=question.fixture&q=task")),
		);
		expect(findElement("#response-form textarea")).toBe(body);
		expect(body.value).toBe("Keep my answer");
		expect(body.selectionStart).toBe(5);
		expect(body.selectionEnd).toBe(7);
	},
);
