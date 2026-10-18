import { createMemoryHistory, RouterContextProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { act, useCallback, useRef, useState } from "react";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { DocumentView } from "#client/document/View.ts";
import { documentData } from "#test/documentRendering.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardRouter } from "./boardRouter.ts";
import { DocumentContext } from "./DocumentContext.tsx";
import type { RouterShell } from "./loadBoardPage.ts";
import { MainLocationContext } from "./MainLocationContext.ts";
import { emptyMainLocation } from "./mainLocation.ts";
import { ReadingReadyContext } from "./ReadingReadyContext.ts";
import { shellIds } from "./shellIds.ts";
import { useBoardNavigation } from "./useBoardNavigation.ts";

expectNoReactWarnings();
const data = documentData("# Plan\n\n## Evidence\n\nRead this passage.");
const ROUTE = "/nested/reading.md";
const main = { ...emptyMainLocation, file: data.file, route: ROUTE };

function Navigation({ shell }: { readonly shell: RouterShell }) {
	useBoardNavigation(shell);
	return null;
}

function Reading({ shell }: { readonly shell: RouterShell }) {
	const [element, setElement] = useState<HTMLElement | null>(null);
	const [outlined, setOutlined] = useState(false);
	const reportedRef = useRef<HTMLElement | null>(null);
	const report = useCallback((next: HTMLElement, ready: boolean) => {
		reportedRef.current = ready ? next : null;
		if (ready) {
			setOutlined(true);
		}
	}, []);
	return (
		<ReadingReadyContext.Provider value={{ element, report }}>
			<Navigation shell={shell} />
			<main id={shellIds.doc} tabIndex={-1}>
				{outlined ? null : <aside className="item-context" />}
				<DocumentView context={<DocumentContext document={data} />} document={data} />
			</main>
			<button data-release-reading onClick={() => setElement(reportedRef.current)} type="button">
				Release readiness
			</button>
		</ReadingReadyContext.Provider>
	);
}

screenStory.it(
	"waits beyond the initial frame and restores only when the document's readiness reaches navigation",
	[],
	function* ({ renderBoard, click }) {
		const router = boardRouter(undefined, createMemoryHistory({ initialEntries: [`${ROUTE}#heading-evidence`] }));
		const view = yield* Effect.promise(() =>
			renderBoard({}, (api, registry) => (
				<RouterContextProvider router={router}>
					<MainLocationContext.Provider value={main}>
						<Reading shell={{ api, registry }} />
					</MainLocationContext.Provider>
				</RouterContextProvider>
			)),
		);

		yield* Effect.promise(() => eventually(() => expect(document.querySelector('.document-outline a[href="#heading-evidence"]')).not.toBeNull()));
		yield* Effect.promise(() => act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))));
		expect(document.activeElement?.id).not.toBe("heading-evidence");
		expect(router.state.location.pathname).toBe(ROUTE);
		expect(router.state.location.hash).toBe("heading-evidence");
		click(view.container.querySelector<HTMLButtonElement>("[data-release-reading]"));
		yield* Effect.promise(() => eventually(() => expect(document.activeElement?.id).toBe("heading-evidence")));
	},
);
