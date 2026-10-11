import { Option } from "effect";
import { expect, it } from "vitest";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { type BoardTestApi, renderBoard } from "#test/react.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

function SearchResults({ api }: { readonly api: BoardTestApi }) {
	const query = useQuery(api.search.query({ query: "Morning walk" }));
	return (
		<output>{Option.match(query.data, { onNone: () => "Loading", onSome: ({ results }) => results.map((entry) => entry.text).join("; ") })}</output>
	);
}

it("renders a Board search through real RPC handlers and the React atom registry in happy-dom", async () => {
	const view = await renderBoard({ "other.md": "# Other\n\nEvening read\n", "plan.md": "# Plan\n\nMorning walk\n" }, (api) => (
		<SearchResults api={api} />
	));
	try {
		await eventually(() => expect(view.container.querySelector("output")?.textContent).toBe("Morning walk"));
	} finally {
		await view.unmount();
	}
	expect(view.container.isConnected).toBe(false);
});
