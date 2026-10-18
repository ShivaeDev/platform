import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Effect, Option } from "effect";
import { expect } from "vitest";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { DocumentView } from "#client/document/View.ts";
import type { BoardTestApi } from "#test/react.tsx";
import { DECISION_PATH, packetFiles, questionPath } from "#test/responsePacket.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { boardRouter } from "./boardRouter.ts";

expectNoReactWarnings();

function PacketDocument({ api }: { readonly api: BoardTestApi }) {
	const query = useQuery(api.document.query({ url: `/${questionPath}` }));
	return Option.match(query.data, { onNone: () => null, onSome: (document) => <DocumentView document={document} /> });
}

function expectProse(container: HTMLElement) {
	expect(container.querySelector("h1")?.textContent).toBe("Choose a direction");
	expect(container.querySelector("article.doc")?.textContent).toContain("Read the evidence before choosing.");
	expect([...container.querySelectorAll("article.doc h2")].map((heading) => heading.textContent)).toEqual(["Recommendation"]);
	expect(container.querySelector("article.doc")?.textContent).not.toContain('"attention"');
}

for (const path of [DECISION_PATH, questionPath]) {
	screenStory.it(
		`reads packet prose in the React shell at ${path}`,
		[
			boardScreen(packetFiles, (api, registry) => {
				const router = boardRouter({ api, registry });
				router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: [`/${path}`] }) });
				return <RouterProvider router={router} />;
			}),
		],
		function* ({ boardView }) {
			const view = boardView();

			yield* Effect.promise(() =>
				eventually(() => expect(view.container.querySelector("article.doc p")?.textContent).toContain("Read the evidence")),
			);
			expectProse(view.container);
		},
	);
}

screenStory.it(
	"reads captured document prose through the native document query and React Markdown view",
	[boardScreen(packetFiles, (api) => <PacketDocument api={api} />)],
	function* ({ boardView }) {
		const view = boardView();

		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("article.doc p")?.textContent).toContain("Read the evidence")));
		expectProse(view.container);
	},
);
