import { Effect, Option } from "effect";
import { expect } from "vitest";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import { eventually } from "@shivaedev/effect-react/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import { DocumentPage } from "#client/react/DocumentPage.tsx";
import { type BoardTestApi, renderBoard } from "#test/react.tsx";
import { metadataStyles } from "./metadata.ts";

function Page({ api }: { readonly api: BoardTestApi }) {
	const query = useQuery(api.document.query({ url: "/task.md" }));
	return (
		<>
			<style>{metadataStyles}</style>
			{Option.match(query.data, { onNone: () => null, onSome: (data) => <DocumentPage document={data} /> })}
		</>
	);
}

it.live("leaves criterion and recorded-evidence scroll clearance to the item layout", function* () {
	const view = yield* Effect.promise(() =>
		renderBoard(
			{
				"task.md":
					"---\nid: task.fixture\nkind: task\ncriteria:\n  - id: review\n    text: Review the passage\nevidence:\n  - source: https://example.com/review\n    criterion: task.fixture#review\n---\n# Review\n",
			},
			(api) => <Page api={api} />,
		),
	);
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("#recorded-evidence-0")).not.toBeNull()));
		for (const id of ["criterion-review", "recorded-evidence-0"]) {
			const target = view.container.querySelector(`#${id}`);
			expect(target?.closest(".item-context")).not.toBeNull();
			if (!target) {
				throw new Error("Missing passage target");
			}
			expect(getComputedStyle(target).scrollMarginTop).toBe("");
		}
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});
