import type { Document } from "#browser/document/schema.ts";
import { DocumentView } from "#client/document/View.ts";
import { StatusChip } from "#client/react/components/ui/StatusChip.tsx";
import { AnswerPanel } from "./AnswerPanel.tsx";
import { DocumentContext } from "./DocumentContext.tsx";
export function DocumentPage({ document }: { readonly document: Document }) {
	return (
		<>
			<DocumentView context={<DocumentContext document={document} />} document={document} introduction={<Introduction document={document} />} />
			{document.metadata.kind === "question" && document.metadata.question === undefined && document.identity !== undefined && (
				<AnswerPanel document={document} />
			)}
		</>
	);
}
function Introduction({ document }: { readonly document: Document }) {
	if (document.reading?.raw === undefined) {
		return null;
	}
	return (
		<section aria-label="Authored work" className="item-summary">
			<p>
				Status (source): <StatusChip status={document.metadata.status} />
				{document.metadata.owner ? ` · Owner: ${document.metadata.owner}` : ""}
			</p>
			<p>Next action: {document.metadata.nextAction ?? "Not recorded"}</p>
		</section>
	);
}
