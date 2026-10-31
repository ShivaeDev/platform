import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { laterReadHeld, readingPage } from "#test/readingScreenTraits.tsx";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

const files = {
	"home.md": "# Home\n\n## Plans\n",
	"notes/first.md": "# First\n\n<details><summary>Evidence</summary>Retained evidence</details>\n",
	"notes/next.md": "# Next\n",
};
const nextHeld = [readingPage(files, "/notes/first.md", { home: "home.md" }), laterReadHeld("/notes/next.md")];

screenStory.it(
	"opening a document whose read has not answered shows a document-shaped loading state at the new address instead of the old document",
	nextHeld,
	function* ({ address, loadingPage, navigateTo, shownPage }) {
		yield* navigateTo("/notes/next.md");

		yield* outcomes({
			address: [address(), "/notes/next.md"],
			loading: [loadingPage(), { message: "Loading page", shape: "document" }],
			page: [shownPage(), "none"],
		});
	},
);

screenStory.it(
	"a document whose read was held opens in the same page shell once the read answers",
	nextHeld,
	function* ({ documentShell, heldReadFinishes, navigateTo, shownPage }) {
		yield* documentShell();
		yield* navigateTo("/notes/next.md");

		yield* heldReadFinishes();

		yield* outcomes({
			page: [shownPage(), "Next"],
			shell: [documentShell(), "the shell the page opened in"],
		});
	},
);

screenStory.it(
	"after going Back before a held read answers, the late answer leaves the first document and its open section in place",
	nextHeld,
	function* ({ address, goBack, heldReadFinishes, navigateTo, openSection, openSections, shownPage }) {
		yield* openSection("Evidence");
		yield* navigateTo("/notes/next.md");
		yield* goBack();

		yield* heldReadFinishes();

		yield* outcomes({
			address: [address(), "/notes/first.md"],
			"open sections": [openSections(), ["Evidence"]],
			page: [shownPage(), "First"],
		});
	},
);

screenStory.it(
	"going Back from a second document shows the first one in the same page shell",
	[readingPage(files, "/notes/first.md")],
	function* ({ documentShell, goBack, navigateTo, shownPage }) {
		yield* documentShell();
		yield* navigateTo("/notes/next.md");

		yield* goBack();

		yield* outcomes({
			page: [shownPage(), "First"],
			shell: [documentShell(), "the shell the page opened in"],
		});
	},
);
