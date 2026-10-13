import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Document } from "#browser/document/schema.ts";
import { Age } from "./Age.tsx";
import { DocumentMetadata } from "./DocumentMetadata.tsx";
import { Favorite } from "./Favorite.tsx";
import { useMedia } from "./useMedia.ts";

export function DocumentContext({ document: data }: { readonly document: Document }) {
	const [headings, setHeadings] = useState<readonly { readonly id: string; readonly title: string; readonly depth: number }[]>([]);
	const contextRef = useRef<HTMLDetailsElement>(null);
	const wide = useMedia("(min-width: 1100px)");
	useLayoutEffect(() => {
		if (contextRef.current) {
			contextRef.current.open = wide;
		}
	}, [wide]);
	useEffect(() => {
		function outline() {
			const entries = [
				...(contextRef.current?.closest("main")?.querySelectorAll<HTMLElement>(".item-introduction h1, article.doc :is(h1,h2,h3,h4,h5,h6)") ?? []),
			]
				.filter((heading) => heading.id)
				.map((heading) => ({ depth: Number(heading.tagName.slice(1)), id: heading.id, title: heading.textContent?.replace(/#$/u, "") ?? "" }));
			setHeadings((current) => (JSON.stringify(current) === JSON.stringify(entries) ? current : entries));
		}
		document.addEventListener("board-page", outline);
		outline();
		return () => document.removeEventListener("board-page", outline);
	}, []);

	useLayoutEffect(() => {
		const context = contextRef.current;
		if (!context) {
			return;
		}
		const count = context.closest("main")?.querySelectorAll(".item-introduction h1[id], article.doc :is(h1,h2,h3,h4,h5,h6)[id]").length ?? 0;
		if (count !== headings.length) {
			return;
		}
		context.dataset.readingReady = "true";
		document.dispatchEvent(new Event("board-reading-ready"));
	}, [headings]);
	return (
		<details className="item-context" data-key="item-context" ref={contextRef}>
			<summary>Context and tools</summary>
			<div className="context-content">
				<p className="meta">
					Source: {data.file} · <Age modified={data.modified} />
				</p>
				<DocumentMetadata document={data} />
				<div className="reading-tools">
					<Favorite file={data.file} title={headings.find((heading) => heading.depth === 1)?.title || data.file} />
					<Outline headings={headings} />
				</div>
			</div>
		</details>
	);
}

function Outline({ headings }: { readonly headings: readonly { readonly id: string; readonly title: string; readonly depth: number }[] }) {
	if (headings.length === 0) {
		return null;
	}
	const entries = headings.map((heading) => (
		<li data-depth={heading.depth} key={heading.id}>
			<a href={`#${heading.id}`}>{heading.title || "Section"}</a>
		</li>
	));
	return (
		<details className="outline" data-key="outline">
			<summary>On this page</summary>
			<nav aria-label="Document outline">
				<ol>{entries}</ol>
			</nav>
		</details>
	);
}
