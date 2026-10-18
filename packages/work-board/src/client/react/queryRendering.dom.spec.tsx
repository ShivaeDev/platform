import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { QuerySearchResults } from "#test/QuerySearchResults.tsx";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"renders a Board search through real RPC handlers and the React atom registry in happy-dom",
	[boardScreen({ "other.md": "# Other\n\nEvening read\n", "plan.md": "# Plan\n\nMorning walk\n" }, (api) => <QuerySearchResults api={api} />)],
	function* ({ boardView, readText, closeScreen }) {
		const view = boardView();

		yield* Effect.promise(() => eventually(() => expect(readText("output")).toBe("Morning walk")));

		yield* Effect.promise(closeScreen);
		expect(view.container.isConnected).toBe(false);
	},
);
