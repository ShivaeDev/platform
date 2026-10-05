import { expect, it } from "vitest";
import { fieldFilter, stateOf, viewUrl } from "./state.ts";

it("round trips exact board, filter, sort, and selection values without confusing missing fields", () => {
	const state = stateOf(
		"/_board/work?view=table&board=board.review&item=work.search&owner=value%3Aagent%20%26%20review&status=value%3Amissing&sort=owner&q=review+search",
	);
	expect(stateOf(viewUrl(state))).toEqual(state);
	expect(fieldFilter(undefined)).toBe("missing");
	expect(fieldFilter("missing")).toBe("value:missing");
	expect(viewUrl(state, { item: "" }, "work-results")).not.toContain("item=");
	expect(viewUrl(state, {}, "work-detail").endsWith("#work-detail")).toBe(true);
});

it("bounds search text and uses the supported default for unknown sorting", () => {
	const state = stateOf(`/_board/work?sort=mtime&q=${"a".repeat(500)}`);
	expect(state.sort).toBe("title");
	expect(stateOf("/_board/work?view=unknown").view).toBe("board");
	expect(state.query).toHaveLength(200);
});
