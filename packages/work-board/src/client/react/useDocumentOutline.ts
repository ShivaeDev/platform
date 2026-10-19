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
