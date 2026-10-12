import { useEffect, useRef, useState } from "react";
import type { Document } from "#browser/document/schema.ts";
import { DocumentMetadata } from "./DocumentMetadata.tsx";
import { shellIds } from "./shellIds.ts";

export function DocumentContext({ document: data }: { readonly document: Document }) {
	const [headings, setHeadings] = useState<readonly { readonly id: string; readonly title: string; readonly depth: number }[]>([]);
	const contextRef = useRef<HTMLDetailsElement>(null);
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
	return (
		<details className="item-context" data-key="item-context" ref={contextRef}>
			<summary>Context and tools</summary>
			<div className="context-content">
				<p className="meta">
					Source: {data.file} ·{" "}
					<span className="age" data-modified={data.modified}>
						updated
					</span>
				</p>
				<DocumentMetadata document={data} />
				<div className="reading-tools">
					<button aria-pressed="false" disabled id={shellIds.favoriteToggle} type="button">
						Save favorite
					</button>
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
