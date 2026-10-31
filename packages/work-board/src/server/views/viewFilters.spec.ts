import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";

const tasks = projectFiles({
	"missing.md": "---\nid: missing\nkind: task\n---\n# No owner",
	"owned.md": "---\nid: owned\nkind: task\nowner: marvin\n---\n# Owned task",
});
boardStory.it("distinguishes missing owners from a canonical owner and preserves selection outside a filter", [tasks], function* ({ rpc }) {
	const absent = yield* rpc((client) => client("work-board.work", { url: "/_board/work?view=table&owner=missing" }));
	expect(absent.rows.map((row) => row.id)).toEqual(["missing"]);
	const literal = yield* rpc((client) => client("work-board.work", { url: "/_board/work?view=table&owner=value%3Amarvin&item=missing" }));
	expect(literal.rows.map((row) => row.id)).toEqual(["owned"]);
	expect(literal.selected?.file).toBe("missing.md");
	expect(literal.selectedOutside).toBe(true);
});
boardStory.it("bounds search text and normalizes unknown views and sorting at the HTTP contract", [tasks], function* ({ rpc }) {
	const work = yield* rpc((client) => client("work-board.work", { url: `/_board/work?view=unknown&sort=mtime&q=${"a".repeat(500)}` }));
	expect(work.state.view).toBe("now");
	expect(work.state.sort).toBe("title");
	expect(work.state.query).toBe("a".repeat(200));
});
