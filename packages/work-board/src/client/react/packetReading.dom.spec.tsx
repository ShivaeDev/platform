import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Effect, Option } from "effect";
import { expect } from "vitest";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import { DocumentView } from "#client/document/View.ts";
import { type BoardTestApi, renderBoard } from "#test/react.tsx";
import { DECISION_PATH, packetFiles, questionPath } from "#test/responsePacket.ts";
import { boardRouter } from "./boardRouter.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
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

it.live.each([DECISION_PATH, questionPath])("reads packet prose in the React shell at %s", function* (path) {
	const view = yield* Effect.promise(() =>
		renderBoard(packetFiles, (api, registry) => {
			const router = boardRouter({ api, initial: "", registry });
			router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: [`/${path}`] }) });
			return <RouterProvider router={router} />;
		}),
	);
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("article.doc p")?.textContent).toContain("Read the evidence")));
		expectProse(view.container);
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});

it.live("reads captured document prose through the native document query and React Markdown view", function* () {
	const view = yield* Effect.promise(() => renderBoard(packetFiles, (api) => <PacketDocument api={api} />));
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("article.doc p")?.textContent).toContain("Read the evidence")));
		expectProse(view.container);
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});
