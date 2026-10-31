import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { QuerySearchResults } from "#test/QuerySearchResults.tsx";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"a Board search for Morning walk renders the one matching passage through the RPC handlers and the atom registry",
	[boardScreen({ "other.md": "# Other\n\nEvening read\n", "plan.md": "# Plan\n\nMorning walk\n" }, (api) => <QuerySearchResults api={api} />)],
	function* ({ searchOutput }) {
		expect(yield* searchOutput()).toBe("Morning walk");
	},
);
