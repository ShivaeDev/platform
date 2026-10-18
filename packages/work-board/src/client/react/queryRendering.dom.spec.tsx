import { Effect, Option } from "effect";
import { expect } from "vitest";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import type { BoardTestApi } from "#test/react.tsx";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
function SearchResults({ api }: { readonly api: BoardTestApi }) {
	const query = useQuery(api.search.query({ query: "Morning walk" }));
	return (
		<output>{Option.match(query.data, { onNone: () => "Loading", onSome: ({ results }) => results.map((entry) => entry.text).join("; ") })}</output>
	);
}
screenStory.it(
	"renders a Board search through real RPC handlers and the React atom registry in happy-dom",
	[boardScreen({ "other.md": "# Other\n\nEvening read\n", "plan.md": "# Plan\n\nMorning walk\n" }, (api) => <SearchResults api={api} />)],
	function* ({ boardView }) {
		const view = boardView();
		try {
			yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("output")?.textContent).toBe("Morning walk")));
		} finally {
			yield* Effect.promise(() => view.unmount());
		}
		expect(view.container.isConnected).toBe(false);
	},
);
