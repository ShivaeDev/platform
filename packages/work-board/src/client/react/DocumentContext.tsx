import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Document } from "#browser/document/schema.ts";
import { Tabs } from "#client/react/components/ui/Tabs.tsx";
import { Age } from "./Age.tsx";
import { DocumentMetadata } from "./DocumentMetadata.tsx";
import { DocumentSource } from "./DocumentSource.tsx";

export function DocumentContext({ document: data }: { readonly document: Document }) {
	const [headings, setHeadings] = useState<readonly { readonly id: string; readonly title: string; readonly depth: number }[]>([]);
	const contextRef = useRef<HTMLElement>(null);
	const [tab, setTab] = useState("details");
	useEffect(() => {
		function outline() {
			const entries = [
				...(contextRef.current
					?.closest("main")
					?.querySelectorAll<HTMLElement>(".item-introduction h1, :is(.document-lead, article.doc, .document-layout > .board) :is(h1,h2,h3,h4,h5,h6)")
					?? []),
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
		const count =
			context
				.closest("main")
				?.querySelectorAll(".item-introduction h1[id], :is(.document-lead, article.doc, .document-layout > .board) :is(h1,h2,h3,h4,h5,h6)[id]").length
			?? 0;
		if (count !== headings.length) {
			return;
		}
		context.dataset.readingReady = "true";
		document.dispatchEvent(new Event("board-reading-ready"));
	}, [headings]);
	const tabs = [
		{ content: <Outline headings={headings} />, label: "Details", value: "details" },
		{ content: <SourcePanel document={data} />, label: "Source", value: "source" },
	];
	return (
		<aside
			aria-label="Item context"
			className="item-context row-start-3 min-w-0 self-start rounded-lg border border-border p-4 text-sm lg:col-start-2 lg:row-start-2"
			data-key="item-context"
			ref={contextRef}
		>
			<Tabs label="Item context" onValueChange={setTab} tabs={tabs} value={tab} />
			<DocumentMetadata document={data} />
		</aside>
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
		<details className="document-outline" data-key="outline">
			<summary>On this page</summary>
			<nav aria-label="Document outline">
				<ol>{entries}</ol>
			</nav>
		</details>
	);
}

function SourcePanel({ document }: { readonly document: Document }) {
	return (
		<>
			<DocumentSource document={document} />
			<Age modified={document.modified} />
		</>
	);
}
