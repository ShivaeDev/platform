import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { paletteFixture } from "#test/paletteFixture.ts";

const palette = projectFiles(paletteFixture());

boardStory.it(
	"a plain search puts the inbox task first and leaves out captured records and responses",
	[palette],
	function* ({ firstResult, resultSources }) {
		yield* outcomes({
			"first result": [
				firstResult("inbox"),
				expect.objectContaining({ id: "task.triage", itemKind: "task", status: "ready", title: "Build the inbox" }),
			],
			"result sources": [resultSources("inbox"), ["task.md", "passage.md"]],
		});
	},
);

boardStory.it("a records: search still puts the inbox task first and adds the captured decisions", [palette], function* ({ resultIds }) {
	expect(yield* resultIds("records: inbox")).toEqual(expect.arrayContaining(["task.triage", "decision.delivery.0"]));
});

for (const [query, id] of [
	["records: decision.delivery.9", "decision.delivery.9"],
	["task.triage", "task.triage"],
] as const) {
	boardStory.it(`searching for ${query} finds ${id} first`, [palette], function* ({ firstResult }) {
		expect(yield* firstResult(query)).toMatchObject({ id });
	});
}

for (const query of ["records: inbox", "records: task.example", "records: application", "records: recorded", "records: context"]) {
	boardStory.it(`snippets found by ${JSON.stringify(query)} show no front matter or captured JSON fields`, [palette], function* ({ dataInSnippets }) {
		expect(yield* dataInSnippets(query)).toEqual([]);
	});
}

const withHumanQuestion = projectFiles({
	...paletteFixture(),
	"human.md": "---\nid: question.human\nkind: question\nscope: task\nurgency: whenever\n---\n# Human question\n",
});

for (const query of ["question", "answer", "application", "context"]) {
	boardStory.it(
		`a plain search for ${query} leaves out the captured responses that a records: search finds`,
		[withHumanQuestion],
		function* ({ resultSources }) {
			yield* outcomes({
				"plain search": [resultSources(query), expect.not.arrayContaining([expect.stringMatching(/^responses\//u)])],
				"records: search": [resultSources(`records: ${query}`), expect.arrayContaining([expect.stringMatching(/^responses\//u)])],
			});
		},
	);
}

boardStory.it("a human question stays in a plain search and comes first for its title", [withHumanQuestion], function* ({ firstResult }) {
	expect(yield* firstResult("human")).toMatchObject({ id: "question.human" });
});

boardStory.it(
	"captured data in any quoting style stays out of snippets while a readable passage is shown",
	[
		projectFiles({
			"boolean.md": '# Context\n\nNeedle captured {"ready":true,"ready":false}.\n',
			"embedded.md": '# Context\n\nCaptured data {"id": "needle", "kind": "task"} ends here.\n',
			"json.md": '# Context\n\n{"id": "needle", "kind": "task"}\n',
			"note.md": "# Note\n\nA readable needle passage.\n",
			"single-quoted.md": "# Context\n\nCaptured data {'id' : 'needle', 'kind' : 'task'} ends here.\n",
			"spaced.md": '# Context\n\nCaptured data {"id" : "needle", "kind" : "task"} ends here.\n',
			"unquoted.md": "# Context\n\nCaptured data {id : needle, kind : task} ends here.\n",
			"yaml.md": "---\nid: needle\nkind: task\nstatus: ready\n",
		}),
	],
	function* ({ searchSnippets }) {
		expect(yield* searchSnippets("needle")).toEqual({
			"boolean.md": "",
			"embedded.md": "",
			"json.md": "",
			"note.md": "A readable needle passage.",
			"single-quoted.md": "",
			"spaced.md": "",
			"unquoted.md": "",
			"yaml.md": "",
		});
	},
);

boardStory.it(
	"inline Markdown in a criterion shows as plain text in its snippet",
	[
		projectFiles({
			"tasks/snippet.md":
				'---\nid: task.snippet\nkind: task\nstatus: ready\ncriteria:\n  - id: plain\n    text: "Search shows `code`, **bold**, _emphasis_, ~~old~~ and [linked](https://example.com/page) words as plain text, keeping snake_case_names and 2*3*4."\n---\n# Snippet item\n',
		}),
	],
	function* ({ shownSnippets }) {
		expect(yield* shownSnippets("search shows")).toEqual([
			"Search shows code, bold, emphasis, old and linked words as plain text, keeping snake_case_names and 2*3*4.",
		]);
	},
);
