import { useContext, useLayoutEffect, useRef, useState } from "react";
import type { Document } from "#browser/document/schema.ts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#client/react/components/ui/tabs.tsx";
import { DocumentMetadata } from "./DocumentMetadata.tsx";
import { DocumentOutline } from "./DocumentOutline.tsx";
import { DocumentSource } from "./DocumentSource.tsx";
import { hasDocumentMetadata } from "./metadataParts.ts";
import { ReadingReadyContext } from "./ReadingReadyContext.ts";
import { Time } from "./Time.tsx";
import { OUTLINE_HEADINGS, useDocumentOutline } from "./useDocumentOutline.ts";

export function DocumentContext({ document: data }: { readonly document: Document }) {
	const { report } = useContext(ReadingReadyContext);
	const contextRef = useRef<HTMLElement>(null);
	const headings = useDocumentOutline(contextRef, data);
	const [tab, setTab] = useState("details");
	const details = hasDocumentMetadata(data);

	useLayoutEffect(() => {
		const context = contextRef.current;
		if (!context) {
			return;
		}
		const count = [...(context.closest("main")?.querySelectorAll<HTMLElement>(OUTLINE_HEADINGS) ?? [])].filter((heading) => heading.id).length;
		if (count !== headings.length) {
			return;
		}
		report(context, true);
		return () => report(context, false);
	}, [headings, report]);
	return (
		<aside
			aria-label="Item context"
			className="item-context row-start-3 flex min-w-0 flex-col gap-6 self-start text-sm empty:hidden lg:col-start-2 lg:row-start-2 lg:self-stretch"
			data-key="item-context"
			ref={contextRef}
		>
			{(details || data.reading?.raw !== undefined) && (
				<div className="border-border rounded-lg border p-4">
					<Tabs onValueChange={setTab} value={tab}>
						<TabsList aria-label="Item context" className="w-full">
							<TabsTrigger value="details">Details</TabsTrigger>
							<TabsTrigger value="source">Source</TabsTrigger>
						</TabsList>
						<TabsContent className="text-sm" hidden={tab !== "details"} keepMounted value="details" {...(details ? {} : { tabIndex: -1 })}>
							<DocumentMetadata document={data} />
						</TabsContent>
						<TabsContent className="pt-2" hidden={tab !== "source"} keepMounted value="source">
							<SourcePanel document={data} />
						</TabsContent>
					</Tabs>
				</div>
			)}
			<DocumentOutline headings={headings} />
		</aside>
	);
}

function SourcePanel({ document }: { readonly document: Document }) {
	return (
		<>
			<DocumentSource document={document} />
			<p className="text-muted-foreground text-xs" data-updated>
				Updated <Time at={document.modified} />
			</p>
		</>
	);
}
