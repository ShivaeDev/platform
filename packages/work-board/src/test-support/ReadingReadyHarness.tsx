import { useCallback, useRef, useState } from "react";
import type { Document } from "#browser/document/schema.ts";
import { DocumentView } from "#client/document/View.ts";
import { DocumentContext } from "#client/react/DocumentContext.tsx";
import type { RouterShell } from "#client/react/loadBoardPage.ts";
import { ReadingReadyContext } from "#client/react/ReadingReadyContext.ts";
import { shellIds } from "#client/react/shellIds.ts";
import { useBoardNavigation } from "#client/react/useBoardNavigation.ts";

export function Navigation({ shell }: { readonly shell: RouterShell }) {
	useBoardNavigation(shell);
	return null;
}

export function ReadingReadyHarness({ shell, document: data }: { readonly shell: RouterShell; readonly document: Document }) {
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
