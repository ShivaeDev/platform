import type { Document } from "#browser/document/schema.ts";
import { DocumentView } from "#client/document/View.ts";
import { AnswerPanel } from "./AnswerPanel.tsx";
import { DocumentContext } from "./DocumentContext.tsx";
import { DocumentCriteria } from "./DocumentCriteria.tsx";
import { documentElements } from "./documentElements.tsx";
import { GoalPage } from "./GoalPage.tsx";
import { GoalProgressHeader } from "./GoalProgressHeader.tsx";
import { ItemActions, ItemSummary } from "./ItemSummary.tsx";
import type { ShellApi } from "./ShellApi.ts";
export function DocumentPage({ document, api }: { readonly document: Document; readonly api?: ShellApi | undefined }) {
	const projectContent = api ? <GoalPage api={api} document={document} /> : <DocumentCriteria document={document} />;
	return (
		<DocumentView
			actions={<ItemActions document={document} />}
			answer={<AnswerPanel document={document} />}
			components={documentElements}
			content={document.metadata.kind === "project" ? projectContent : undefined}
			context={<DocumentContext document={document} />}
			document={document}
			introduction={<ItemSummary document={document} />}
			lead={api && document.metadata.kind === "project" ? <GoalProgressHeader api={api} document={document} /> : undefined}
		/>
	);
}
