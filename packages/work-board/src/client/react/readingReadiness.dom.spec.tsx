import { createMemoryHistory, RouterContextProvider } from "@tanstack/react-router";
import { act, useCallback, useRef, useState } from "react";
import { expect, it } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { DocumentView } from "#client/document/View.ts";
import { documentData } from "#test/documentRendering.ts";
import { renderBoard } from "#test/react.tsx";
import { boardRouter } from "./boardRouter.ts";
import { DocumentContext } from "./DocumentContext.tsx";
import type { RouterShell } from "./loadBoardPage.ts";
import { MainLocationContext } from "./MainLocationContext.ts";
import { emptyMainLocation } from "./mainLocation.ts";
import { ReadingReadyContext } from "./ReadingReadyContext.ts";
import { shellIds } from "./shellIds.ts";
import { useBoardNavigation } from "./useBoardNavigation.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
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

it("waits beyond the initial frame and restores only when the document's readiness reaches navigation", async () => {
	const router = boardRouter(undefined, createMemoryHistory({ initialEntries: [`${ROUTE}#heading-evidence`] }));
	const view = await renderBoard({}, (api, registry) => (
		<RouterContextProvider router={router}>
			<MainLocationContext.Provider value={main}>
				<Reading shell={{ api, registry }} />
			</MainLocationContext.Provider>
		</RouterContextProvider>
	));
	try {
		await eventually(() => expect(document.querySelector('.document-outline a[href="#heading-evidence"]')).not.toBeNull());
		await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
		expect(document.activeElement?.id).not.toBe("heading-evidence");
		expect(router.state.location.pathname).toBe(ROUTE);
		expect(router.state.location.hash).toBe("heading-evidence");
		act(() => view.container.querySelector<HTMLButtonElement>("[data-release-reading]")?.click());
		await eventually(() => expect(document.activeElement?.id).toBe("heading-evidence"));
	} finally {
		await view.unmount();
	}
});
