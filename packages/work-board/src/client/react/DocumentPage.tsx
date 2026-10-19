import type { Document } from "#browser/document/schema.ts";
import { AnswerPanel } from "./AnswerPanel.tsx";
import { DecisionOutcome } from "./DecisionOutcome.tsx";
import { DocumentContext } from "./DocumentContext.tsx";
import { BodyCriteria, DocumentCriteria } from "./DocumentCriteria.tsx";
import { OutlineMenu } from "./DocumentOutline.tsx";
import { documentElements } from "./documentElements.tsx";
import { GoalPage } from "./GoalPage.tsx";
import { GoalProgressHeader } from "./GoalProgressHeader.tsx";
import { ItemActions, ItemSummary } from "./ItemSummary.tsx";
import { LazyDocumentView } from "./lazyMarkdown.tsx";
import type { ShellApi } from "./ShellApi.ts";
export function DocumentPage({ document, api }: { readonly document: Document; readonly api?: ShellApi | undefined }) {
	const projectContent = api ? <GoalPage api={api} document={document} /> : <DocumentCriteria document={document} />;
	const question = document.metadata.kind === "question";
	return (
		<LazyDocumentView
			actions={
				<>
					<OutlineMenu document={document} />
					<ItemActions document={document} />
				</>
			}
			after={question ? <AnswerPanel after document={document} /> : undefined}
			answer={question ? undefined : <AnswerPanel document={document} />}
			closing={<BodyCriteria document={document} />}
			components={documentElements}
			content={document.metadata.kind === "project" ? projectContent : <DecisionOutcome document={document} />}
			context={<DocumentContext document={document} />}
			document={document}
			introduction={<ItemSummary document={document} />}
			lead={api && document.metadata.kind === "project" ? <GoalProgressHeader api={api} document={document} /> : undefined}
		/>
	);
}
