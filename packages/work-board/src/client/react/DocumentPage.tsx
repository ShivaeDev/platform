import type { Document } from "#browser/document/schema.ts";
import { DocumentView } from "#client/document/View.ts";
import { AnswerPanel } from "./AnswerPanel.tsx";
import { DocumentContext } from "./DocumentContext.tsx";
import { GoalPage } from "./GoalPage.tsx";
import { ItemSummary } from "./ItemSummary.tsx";
import type { ShellApi } from "./ShellApi.ts";
export function DocumentPage({ document, api }: { readonly document: Document; readonly api?: ShellApi | undefined }) {
	return (
		<DocumentView
			answer={<AnswerPanel document={document} />}
			content={api && document.metadata.kind === "project" ? <GoalPage api={api} document={document} /> : undefined}
			context={<DocumentContext document={document} />}
			document={document}
			introduction={<ItemSummary document={document} />}
		/>
	);
}
