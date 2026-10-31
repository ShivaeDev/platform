import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";

const note = projectFiles({ "note.md": "# Note" });

for (const [route, location] of [
	["overview", "/"],
	["inbox", "/"],
	["changes", "/_board/library?view=recently-changed"],
	["diagnostics", "/_board/system"],
	["result?item=result.keyboard", "/_board/item/result.keyboard/"],
	["result", "/_board/library?kind=result"],
]) {
	boardStory.it(`the retired /_board/${route} redirects to ${location}`, [note], function* ({ download }) {
		expect(yield* download(`/_board/${route}`)).toMatchObject({ location, status: "Found" });
	});
}

for (const route of ["/", "/note.md", "/_board/work", "/_board/start", "/_board/handoff", "/_board/system"]) {
	boardStory.it(`${route} serves the board's shell with no inline style, template or noscript fallback`, [note], function* ({ pageShell }) {
		expect(yield* pageShell(route)).toMatchObject({ legacy: [], skeleton: ["aside", "header", "nav"], status: "OK" });
	});
}
