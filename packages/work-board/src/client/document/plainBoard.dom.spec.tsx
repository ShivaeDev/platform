import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { QueryPlainBoard } from "#test/QueryDocument.tsx";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"a board embedded without a context panel is headed by its title and its open and closed column counts",
	[
		boardScreen({ "home.md": "# Release board\n\n## Open\n\n### Draft notes\n\n### Tag release\n\n## Closed\n\n### Plan\n" }, (api) => (
			<QueryPlainBoard api={api} url="/home.md" />
		)),
	],
	function* ({ boardHead, documentsShow }) {
		yield* documentsShow(".board-head h1");

		expect(yield* boardHead()).toEqual({ counts: "2 open · 1 closed", title: "Release board" });
	},
);
