import { createContext } from "react";

export const ReadingReadyContext = createContext<{
	readonly element: HTMLElement | null;
	readonly report: (element: HTMLElement, ready: boolean) => void;
}>({ element: null, report: () => undefined });

export function readingReady(doc: HTMLElement, element: HTMLElement | null) {
	const context = doc.querySelector(".item-context");
	return !context || context === element;
}
