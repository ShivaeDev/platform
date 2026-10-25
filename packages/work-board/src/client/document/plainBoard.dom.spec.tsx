import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { QueryPlainBoard } from "#test/QueryDocument.tsx";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"heads a board embedded without a context panel with its title and column counts",
	[
		boardScreen({ "home.md": "# Release board\n\n## Open\n\n### Draft notes\n\n### Tag release\n\n## Closed\n\n### Plan\n" }, (api) => (
			<QueryPlainBoard api={api} url="/home.md" />
		)),
	],
	function* ({ readText }) {
		yield* eventually(() => expect(readText(".board-head h1")).toBe("Release board"));
		expect(readText(".board-head .counts")).toBe("2 open · 1 closed");
	},
);
