import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Document } from "#browser/document/schema.ts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#client/react/components/ui/tabs.tsx";
import { Age } from "./Age.tsx";
import { DocumentMetadata } from "./DocumentMetadata.tsx";
import { DocumentSource } from "./DocumentSource.tsx";
import { useMainLocation } from "./MainLocationContext.ts";
import { ReadingReadyContext } from "./ReadingReadyContext.ts";

export function DocumentContext({ document: data }: { readonly document: Document }) {
	const page = useMainLocation();
	const { report } = useContext(ReadingReadyContext);
	const [headings, setHeadings] = useState<readonly { readonly id: string; readonly title: string; readonly depth: number }[]>([]);
	const contextRef = useRef<HTMLElement>(null);
	const [tab, setTab] = useState("details");
	useEffect(() => {
		if (page.route && page.projection === "document" && page.file !== data.file) {
			return;
		}
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
		outline();
	}, [page, data]);

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
		report(context, true);
		return () => report(context, false);
	}, [headings, report]);
	return (
		<aside
			aria-label="Item context"
			className="item-context row-start-3 min-w-0 self-start rounded-lg border border-border p-4 text-sm lg:col-start-2 lg:row-start-2"
			data-key="item-context"
			ref={contextRef}
		>
			<Tabs onValueChange={setTab} value={tab}>
				<TabsList aria-label="Item context" className="w-full">
					<TabsTrigger onClick={() => setTab("details")} value="details">
						Details
					</TabsTrigger>
					<TabsTrigger onClick={() => setTab("source")} value="source">
						Source
					</TabsTrigger>
				</TabsList>
				<TabsContent className="pt-2" hidden={tab !== "details"} keepMounted value="details">
					<Outline headings={headings} />
				</TabsContent>
				<TabsContent className="pt-2" hidden={tab !== "source"} keepMounted value="source">
					<SourcePanel document={data} />
				</TabsContent>
			</Tabs>
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
