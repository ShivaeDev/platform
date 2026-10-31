import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { readingPage } from "#test/readingScreenTraits.tsx";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

// Markdown files at the item route's own path must never answer an item URL.
const files = {
	"_board/item/missing.md": "# Unidentified Markdown file\n",
	"_board/item/source.md": "# Colliding Markdown file\n",
	"home.md": "---\nid: home.fixture\n---\n# Project board\n\n## Plans\n\n### Read the task\n",
	"identified.md": "---\nid: source.md\n---\n# Identified source\n",
	"standalone.md": "---\nid: standalone.md\n---\n# Standalone identity\n",
	"task.md": "---\nid: task.fixture\nkind: task\n---\n# Task details\n\nRead the evidence.\n",
};
const items = [
	{ id: "task.fixture", page: "Task details" },
	{ id: "home.fixture", page: "Project board" },
	{ id: "standalone.md", page: "Standalone identity" },
	{ id: "source.md", page: "Identified source" },
	{ id: "missing.fixture", page: "Item not found: No item has the ID missing.fixture. It may be missing, renamed, or invalid." },
	{ id: "missing.md", page: "Item not found: No item has the ID missing.md. It may be missing, renamed, or invalid." },
];

for (const { id, page } of items) {
	for (const url of [`/_board/item/${id}`, `/_board/item/${id}/`]) {
		screenStory.it(
			`opening ${url} shows ${page.split(":")[0]} and keeps the address`,
			[readingPage(files, url, { home: "home.md" })],
			function* ({ address, shownPage }) {
				yield* outcomes({
					address: [address(), url],
					page: [shownPage(), page],
				});
			},
		);

		screenStory.it(
			`navigating from a task to ${url} shows ${page.split(":")[0]} and keeps the address`,
			[readingPage(files, "/task.md", { home: "home.md" })],
			function* ({ address, navigateTo, shownPage }) {
				yield* navigateTo(url);

				yield* outcomes({
					address: [address(), url],
					page: [shownPage(), page],
				});
			},
		);
	}
}
