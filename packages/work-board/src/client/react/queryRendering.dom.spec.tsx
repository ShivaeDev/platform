import { Effect, Option } from "effect";
import { expect } from "vitest";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import { type BoardTestApi, renderBoard } from "#test/react.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
function SearchResults({ api }: { readonly api: BoardTestApi }) {
	const query = useQuery(api.search.query({ query: "Morning walk" }));
	return (
		<output>{Option.match(query.data, { onNone: () => "Loading", onSome: ({ results }) => results.map((entry) => entry.text).join("; ") })}</output>
	);
}
it.live("renders a Board search through real RPC handlers and the React atom registry in happy-dom", function* () {
	const view = yield* Effect.promise(() =>
		renderBoard({ "other.md": "# Other\n\nEvening read\n", "plan.md": "# Plan\n\nMorning walk\n" }, (api) => <SearchResults api={api} />),
	);
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("output")?.textContent).toBe("Morning walk")));
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
	expect(view.container.isConnected).toBe(false);
});
