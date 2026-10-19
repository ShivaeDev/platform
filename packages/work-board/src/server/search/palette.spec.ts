import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { paletteFixture } from "#test/paletteFixture.ts";

boardStory.it(
	"ranks the inbox task ahead of captured decisions and excludes records until requested",
	[projectFiles(paletteFixture())],
	function* ({ search }) {
		const ordinary = yield* search("inbox");
		expect(ordinary.results[0]).toMatchObject({ id: "task.triage", itemKind: "task", status: "active", title: "Build the inbox" });
		expect(ordinary.results.some((entry) => entry.file.startsWith("records/") || entry.file.startsWith("responses/"))).toBe(false);
		const all = yield* search("records: inbox");
		expect(all.results[0]?.id).toBe("task.triage");
		expect(all.results).toEqual(expect.arrayContaining([expect.objectContaining({ id: "decision.delivery.0" })]));
		expect((yield* search("records: decision.delivery.9")).results[0]?.id).toBe("decision.delivery.9");
		expect((yield* search("task.triage")).results[0]?.id).toBe("task.triage");
		for (const query of ["records: inbox", "records: task.example", "records: application", "records: recorded", "records: context"]) {
			const entries = (yield* search(query)).results;
			expect(entries.length).toBeGreaterThan(0);
			for (const entry of entries) {
				expect(entry.snippet).not.toMatch(/^(?:\{|---)/u);
				expect(entry.snippet).not.toMatch(/(?:id|kind|next_action|reviewedRevision|question):/u);
			}
		}
	},
);

boardStory.it(
	"hides captured questions, responses and receipts but keeps human questions",
	[projectFiles({ ...paletteFixture(), "human.md": "---\nid: question.human\nkind: question\n---\n# Human question\n" })],
	function* ({ search }) {
		for (const query of ["question", "answer", "application", "context"]) {
			expect((yield* search(query)).results.some((entry) => entry.file.startsWith("responses/"))).toBe(false);
			expect((yield* search(`records: ${query}`)).results.some((entry) => entry.file.startsWith("responses/"))).toBe(true);
		}
		expect((yield* search("human")).results[0]?.id).toBe("question.human");
	},
);

const privateFiles = {
	"boolean.md": '# Context\n\nNeedle captured {"active":true,"ready":false}.\n',
	"embedded.md": '# Context\n\nCaptured data {"id": "needle", "kind": "task"} ends here.\n',
	"json.md": '# Context\n\n{"id": "needle", "kind": "task"}\n',
	"single-quoted.md": "# Context\n\nCaptured data {'id' : 'needle', 'kind' : 'task'} ends here.\n",
	"spaced.md": '# Context\n\nCaptured data {"id" : "needle", "kind" : "task"} ends here.\n',
	"unquoted.md": "# Context\n\nCaptured data {id : needle, kind : task} ends here.\n",
	"yaml.md": "---\nid: needle\nkind: task\nstatus: active\n",
};
boardStory.it(
	"keeps captured data out of snippets while returning readable prose",
	[projectFiles({ ...privateFiles, "note.md": "# Note\n\nA readable needle passage.\n" })],
	function* ({ search }) {
		const results = (yield* search("needle")).results.filter((entry) => entry.file !== "note.md");
		expect(results.length).toBeGreaterThan(0);
		expect(results.find((entry) => entry.file === "single-quoted.md")?.snippet).toBe("");
		expect(results.find((entry) => entry.file === "spaced.md")?.snippet).toBe("");
		expect(results.find((entry) => entry.file === "unquoted.md")?.snippet).toBe("");
		expect(results.every((entry) => entry.snippet === "")).toBe(true);
		expect((yield* search("readable needle")).results[0]?.snippet).toBe("A readable needle passage.");
	},
);

boardStory.it(
	"shows inline Markdown in snippets as plain text",
	[
		projectFiles({
			"tasks/snippet.md":
				'---\nid: task.snippet\nkind: task\nstatus: active\ncriteria:\n  - id: plain\n    text: "Search shows `code`, **bold**, _emphasis_, ~~old~~ and [linked](https://example.com/page) words as plain text, keeping snake_case_names and 2*3*4."\n---\n# Snippet item\n',
		}),
	],
	function* ({ search }) {
		const results = (yield* search("search shows")).results.filter((entry) => entry.snippet);
		expect(results.length).toBeGreaterThan(0);
		for (const entry of results) {
			expect(entry.snippet).toBe("Search shows code, bold, emphasis, old and linked words as plain text, keeping snake_case_names and 2*3*4.");
		}
	},
);
