import { type RefObject, useEffect, useState } from "react";
import type { Document } from "#browser/document/schema.ts";
import { useMainLocation } from "./MainLocationContext.ts";

export interface OutlineEntry {
	readonly depth: number;
	readonly id: string;
	readonly title: string;
}

export const OUTLINE_HEADINGS = ".item-introduction h1, :is(.document-lead, article.doc, .document-layout > .board) :is(h1,h2,h3,h4,h5,h6)";

export function useDocumentOutline(ref: RefObject<HTMLElement | null>, data: Document) {
	const page = useMainLocation();
	const [headings, setHeadings] = useState<readonly OutlineEntry[]>([]);
	useEffect(() => {
		if (page.route && page.projection === "document" && page.file !== data.file) {
			return;
		}
		const entries = [...(ref.current?.closest("main")?.querySelectorAll<HTMLElement>(OUTLINE_HEADINGS) ?? [])]
			.filter((heading) => heading.id)
			.map((heading) => ({ depth: Number(heading.tagName.slice(1)), id: heading.id, title: heading.textContent?.replace(/#$/u, "") ?? "" }));
		setHeadings((current) => (JSON.stringify(current) === JSON.stringify(entries) ? current : entries));
	}, [page, data, ref]);
	return headings;
}

const READING_LINE = 0.3;

function currentHeading(elements: readonly HTMLElement[]) {
	const root = document.documentElement;
	// The last sections of a document can never scroll up to the reading line, so at the end of the page the lowest visible one counts.
	const end = window.scrollY + window.innerHeight >= root.scrollHeight - 2;
	const line = end ? window.innerHeight : window.innerHeight * READING_LINE;
	return (elements.findLast((element) => element.getBoundingClientRect().top <= line) ?? elements[0])?.id;
}

export function useCurrentHeading(headings: readonly OutlineEntry[]) {
	const [current, setCurrent] = useState<string>();
	useEffect(() => {
		const elements = headings.flatMap((heading) => document.getElementById(heading.id) ?? []);
		if (elements.length === 0 || typeof IntersectionObserver !== "function") {
			return;
		}
		function update() {
			setCurrent(currentHeading(elements));
		}
		// Observers report only headings that cross the reading line or the viewport edge, so scrolling costs nothing in between.
		const observers = [
			new IntersectionObserver(update, { rootMargin: `0px 0px -${100 - READING_LINE * 100}% 0px` }),
			new IntersectionObserver(update),
		];
		for (const observer of observers) {
			for (const element of elements) {
				observer.observe(element);
			}
		}
		update();
		return () => {
			for (const observer of observers) {
				observer.disconnect();
			}
		};
	}, [headings]);
	return current;
}
