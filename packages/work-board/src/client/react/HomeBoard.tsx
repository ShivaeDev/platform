import type { BoardProjection } from "#browser/views/schema.ts";
import { LazyDocumentView } from "./lazyMarkdown.tsx";
import { AnswerPanel } from "./AnswerPanel.tsx";
import { DocumentContext } from "./DocumentContext.tsx";
import { ItemActions, ItemSummary } from "./ItemSummary.tsx";
export function HomeBoard({ data }: { readonly data: BoardProjection }) {
	return (
		<LazyDocumentView
			actions={<ItemActions document={data.document} />}
			answer={<AnswerPanel document={data.document} />}
			board={data.counts}
			context={<DocumentContext document={data.document} />}
			document={data.document}
			introduction={<ItemSummary document={data.document} />}
		/>
	);
}
