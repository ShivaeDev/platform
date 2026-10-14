import type { Document } from "#browser/document/schema.ts";
import { DocumentView } from "#client/document/View.ts";
import { AnswerPanel } from "./AnswerPanel.tsx";
import { DocumentContext } from "./DocumentContext.tsx";
import { ItemSummary } from "./ItemSummary.tsx";
export function DocumentPage({ document }: { readonly document: Document }) {
	return (
		<>
			<DocumentView context={<DocumentContext document={document} />} document={document} introduction={<ItemSummary document={document} />} />
			{document.metadata.kind === "question" && document.metadata.question === undefined && document.identity !== undefined && (
				<AnswerPanel document={document} />
			)}
		</>
	);
}
