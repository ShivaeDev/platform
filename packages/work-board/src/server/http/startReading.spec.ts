import { expect } from "vitest";
import { boardStory } from "#test/boardStory.ts";

boardStory.it("offers copyable source without writing project files or hiding missing documents", [], function* ({ get, rpc, viewHtml, files }) {
	expect((yield* get("/")).status).toBe(200);
	const html = yield* viewHtml("/_board/start");
	expect(html).toContain("Start your local workspace");
	expect(html).toContain("this viewer does not write project files");
	const start = yield* rpc((client) => client("work-board.start", undefined));
	expect(start.empty).toBe(true);
	expect(start.templates.some((template) => template.source.includes("example.result"))).toBe(true);
	expect(files()).toEqual(["board.sock"]);
	expect((yield* get("/missing.md")).status).toBe(404);
	expect((yield* get("/_board/start", "outside.example")).status).toBe(403);
});
boardStory.it(
	"reads copied templates as related documents with no fabricated evidence",
	[],
	function* ({ rpc, editFile, watchProject, viewHtml, readDocument }) {
		const events = yield* watchProject();
		yield* events.next();
		const start = yield* rpc((client) => client("work-board.start", undefined));
		for (const template of start.templates) {
			editFile(template.file, template.source);
		}
		yield* events.changed("result.md");
		const result = yield* readDocument("result.md");
		expect(result.diagnostics).toEqual([]);
		expect(result.metadata.evidence).toBeUndefined();
		expect(yield* viewHtml("/_board/start")).toContain("Project and report templates");
		expect((yield* rpc((client) => client("work-board.start", undefined))).empty).toBe(false);
	},
);
